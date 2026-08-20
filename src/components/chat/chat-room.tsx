"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadLogImages } from "@/lib/logs/upload-log-images";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatChatTime, type ChatMessage } from "@/types/chat";

const MAX_CHAT_PHOTOS = 5;
const MAX_FILE_MB = 12;

function isMissingRelation(message: string | undefined) {
  if (!message) return false;
  return /does not exist|schema cache/i.test(message);
}

function isMissingImageColumn(message: string | undefined) {
  if (!message) return false;
  return /image_urls/i.test(message);
}

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  image_urls?: string[] | null;
};

export function ChatRoom() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [photosEnabled, setPhotosEnabled] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const namesRef = useRef(names);
  const readIdsRef = useRef(readIds);
  const userIdRef = useRef(userId);
  const previewUrlsRef = useRef<string[]>([]);
  namesRef.current = names;
  readIdsRef.current = readIds;
  userIdRef.current = userId;
  previewUrlsRef.current = previewUrls;

  const mapRow = useCallback(
    (row: MessageRow, nameById: Map<string, string>): ChatMessage => {
      return {
        id: row.id,
        sender_id: row.sender_id,
        content: row.content,
        created_at: row.created_at,
        senderName: nameById.get(row.sender_id) ?? "Team member",
        image_urls: (row.image_urls ?? []).filter(Boolean),
      };
    },
    []
  );

  const loadNames = useCallback(
    async (
      supabase: NonNullable<ReturnType<typeof createClient>>,
      ids: string[],
      existing: Map<string, string>
    ) => {
      const missing = [...new Set(ids)].filter((id) => id && !existing.has(id));
      if (!missing.length) return existing;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", missing);
      const next = new Map(existing);
      for (const p of data ?? []) {
        next.set(p.id, p.full_name?.trim() || "Team member");
      }
      for (const id of missing) {
        if (!next.has(id)) next.set(id, "Team member");
      }
      return next;
    },
    []
  );

  const markRead = useCallback(async (ids: string[], currentUserId: string) => {
    const supabase = createClient();
    if (!supabase || !ids.length) return;
    const unread = ids.filter((id) => !readIdsRef.current.has(id));
    if (!unread.length) return;
    const { error: insertError } = await supabase.from("message_reads").insert(
      unread.map((message_id) => ({
        message_id,
        user_id: currentUserId,
      }))
    );
    if (insertError && !/duplicate|unique/i.test(insertError.message)) {
      return;
    }
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const id of unread) next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const readsRes = await supabase
        .from("message_reads")
        .select("message_id")
        .eq("user_id", user.id);

      let withPhotos = true;
      let messagesRes = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at, image_urls")
        .order("created_at", { ascending: true })
        .limit(300);

      if (messagesRes.error && isMissingImageColumn(messagesRes.error.message)) {
        withPhotos = false;
        messagesRes = await supabase
          .from("messages")
          .select("id, sender_id, content, created_at")
          .order("created_at", { ascending: true })
          .limit(300);
      }
      setPhotosEnabled(withPhotos);

      const missing = [messagesRes.error, readsRes.error].find(
        (e) => e && isMissingRelation(e.message)
      );
      if (missing) {
        setSchemaReady(false);
        setError(null);
        setLoading(false);
        return;
      }
      setSchemaReady(true);

      if (messagesRes.error) {
        setError(messagesRes.error.message);
        setLoading(false);
        return;
      }

      const rows = (messagesRes.data ?? []) as MessageRow[];
      const nameById = await loadNames(
        supabase,
        rows.map((r) => r.sender_id),
        new Map()
      );
      setNames(nameById);
      setMessages(rows.map((row) => mapRow(row, nameById)));
      const alreadyRead = new Set(
        (readsRes.data ?? []).map((r) => r.message_id as string)
      );
      setReadIds(alreadyRead);
      readIdsRef.current = alreadyRead;
      setError(null);
      setLoading(false);

      const toMark = rows
        .filter((r) => r.sender_id !== user.id && !alreadyRead.has(r.id))
        .map((r) => r.id);
      await markRead(toMark, user.id);
    })();
  }, [loadNames, mapRow, markRead]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !schemaReady) return;

    const channel = supabase
      .channel("team-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as MessageRow;
          if (!row?.id) return;
          void (async () => {
            const nextNames = await loadNames(
              supabase,
              [row.sender_id],
              namesRef.current
            );
            setNames(nextNames);
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, mapRow(row, nextNames)];
            });
            const currentUser = userIdRef.current;
            if (currentUser && row.sender_id !== currentUser) {
              await markRead([row.id], currentUser);
            }
          })();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNames, mapRow, markRead, schemaReady]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
    );
  }, [messages, search]);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > MAX_FILE_MB * 1024 * 1024) continue;
        if (next.length >= MAX_CHAT_PHOTOS) break;
        next.push(file);
      }
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setPreviewUrls(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setPreviewUrls(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && photos.length === 0) || !userId) return;
    const supabase = createClient();
    if (!supabase) return;
    setSending(true);
    setError(null);

    let imageUrls: string[] = [];
    if (photos.length) {
      if (!photosEnabled) {
        setSending(false);
        setError(
          "Run supabase/migrations/0006_chat_image_urls.sql to send photos."
        );
        return;
      }
      const { urls, error: upErr } = await uploadLogImages(
        supabase,
        userId,
        photos
      );
      if (upErr) {
        setSending(false);
        setError(upErr);
        return;
      }
      imageUrls = urls;
    }

    const payload: {
      sender_id: string;
      content: string;
      image_urls?: string[];
    } = {
      sender_id: userId,
      content,
    };
    if (photosEnabled) {
      payload.image_urls = imageUrls;
    }

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert(payload)
      .select("id, sender_id, content, created_at, image_urls")
      .single();
    setSending(false);
    if (insertError) {
      setError(
        isMissingImageColumn(insertError.message)
          ? "Run supabase/migrations/0006_chat_image_urls.sql to send photos."
          : insertError.message
      );
      return;
    }
    setDraft("");
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPhotos([]);
    setPreviewUrls([]);
    if (data) {
      const row = data as MessageRow;
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, mapRow(row, namesRef.current)];
      });
    }
  }

  const canSend = Boolean(draft.trim() || photos.length) && !sending;

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col">
      <header className="space-y-3 border-b border-border px-4 py-4 md:px-8">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl">Team chat</h1>
          <p className="text-sm text-muted-foreground">
            Internal messages for employees. Clients cannot see this.
          </p>
        </div>
        <div className="space-y-1.5 md:max-w-sm">
          <Label htmlFor="chat-search" className="sr-only md:not-sr-only">
            Search messages
          </Label>
          <Input
            id="chat-search"
            className="min-h-11"
            placeholder="Search messages"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {!schemaReady ? (
        <p className="mx-4 mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:mx-8">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0004_schedule_timeclock_messages_estimates.sql
          </code>{" "}
          in the Supabase SQL Editor to enable team chat.
        </p>
      ) : null}

      {schemaReady && !photosEnabled ? (
        <p className="mx-4 mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:mx-8">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0006_chat_image_urls.sql
          </code>{" "}
          to attach photos in chat.
        </p>
      ) : null}

      {error ? (
        <p className="px-4 pt-3 text-sm text-destructive md:px-8" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        ) : !schemaReady ? null : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search.trim()
              ? "No messages match this search."
              : "No messages yet. Send the first update."}
          </p>
        ) : (
          <ul className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {visible.map((message) => {
              const mine = message.sender_id === userId;
              const images = message.image_urls;
              const text = message.content.trim();
              return (
                <li
                  key={message.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] overflow-hidden rounded-2xl md:max-w-[70%]",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {images.length ? (
                      <div
                        className={cn(
                          "grid gap-1 p-1",
                          images.length > 1 ? "grid-cols-2" : "grid-cols-1"
                        )}
                      >
                        {images.map((url) => (
                          <button
                            key={url}
                            type="button"
                            className="min-h-11 overflow-hidden rounded-xl"
                            onClick={() => setLightbox(url)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt=""
                              className="max-h-56 w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="px-3 py-2">
                      {mine ? null : (
                        <p className="text-xs font-medium">{message.senderName}</p>
                      )}
                      {text ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {text}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 text-[0.7rem]",
                          mine
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatChatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
            <li aria-hidden>
              <div ref={bottomRef} />
            </li>
          </ul>
        )}
      </div>

      {schemaReady ? (
        <form
          onSubmit={send}
          className="sticky bottom-0 z-10 border-t border-border bg-background px-4 py-3 md:px-8"
        >
          <div className="mx-auto w-full max-w-3xl space-y-2">
            {previewUrls.length > 0 ? (
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {previewUrls.map((url, index) => (
                  <li key={url} className="relative size-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="size-16 rounded-lg object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-1 -top-1 size-8 min-h-8 min-w-8 rounded-full"
                      onClick={() => removePhoto(index)}
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11 px-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || photos.length >= MAX_CHAT_PHOTOS}
                aria-label="Attach photo"
              >
                <Camera className="size-5" aria-hidden />
              </Button>
              <Label htmlFor="chat-draft" className="sr-only">
                Message
              </Label>
              <Input
                id="chat-draft"
                className="min-h-11 flex-1"
                placeholder={
                  photos.length ? "Add a caption (optional)" : "Message the team"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                autoComplete="off"
              />
              <Button
                type="submit"
                className="min-h-11 min-w-11 px-4"
                disabled={!canSend}
              >
                <Send className="size-4" aria-hidden />
                <span className="sr-only md:not-sr-only md:ml-1">
                  {sending ? "Sending…" : "Send"}
                </span>
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </button>
      ) : null}
    </main>
  );
}
