import { useCallback, useEffect, useState } from "react";

import { ShopNav } from "@/components/shop-nav";
import { useAuthContext } from "@/hooks/use-authenticated-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, fileExtension, type Barber, type BarberPhoto } from "@/lib/shop";

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30";
const textareaClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30";
const primaryButton =
  "h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60";
const secondaryButton =
  "h-9 rounded-full border border-border px-4 text-sm font-medium transition hover:bg-secondary disabled:opacity-60";

interface BarberForm {
  name: string;
  intro: string;
  address: string;
}

const emptyBarberForm: BarberForm = { name: "", intro: "", address: "" };

function publicPhotoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export default function ShopOnboarding() {
  usePageMeta({
    title: "理髮店設定 — Barberly",
    description: "Set up your shop: payout details, your barbers, and their sample work.",
    ogTitle: "理髮店設定 — Barberly",
    ogDescription: "Set up your Barberly shop.",
  });

  const { user, profile, refreshProfile } = useAuthContext();

  // ── A. Payout settings (shop level, written to profiles) ──
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bankName, setBankName] = useState(profile?.bank_account_name ?? "");
  const [bankNumber, setBankNumber] = useState(profile?.bank_account_number ?? "");
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // ── B. My barbers ──
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoaded, setBarbersLoaded] = useState(false);
  const [newBarber, setNewBarber] = useState<BarberForm>(emptyBarberForm);
  const [creatingBarber, setCreatingBarber] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BarberForm>(emptyBarberForm);
  const [barberError, setBarberError] = useState<string | null>(null);

  // ── C. Sample hairstyle photos, keyed by barber id ──
  const [photos, setPhotos] = useState<Record<string, BarberPhoto[]>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const onboardingComplete =
    displayName.trim() !== "" && bankName.trim() !== "" && bankNumber.trim() !== "";

  const loadBarbers = useCallback(async () => {
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("shop_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      setBarberError(error.message);
      setBarbersLoaded(true);
      return;
    }

    const rows = data ?? [];
    setBarbers(rows);
    setBarbersLoaded(true);

    if (rows.length === 0) {
      setPhotos({});
      return;
    }

    const { data: photoRows, error: photoLoadError } = await supabase
      .from("barber_photos")
      .select("*")
      .in(
        "barber_id",
        rows.map((row) => row.id),
      )
      .order("sort_order", { ascending: true });

    if (photoLoadError) {
      setPhotoError(photoLoadError.message);
      return;
    }

    const grouped: Record<string, BarberPhoto[]> = {};
    for (const photo of photoRows ?? []) {
      const bucket = grouped[photo.barber_id];
      if (bucket) bucket.push(photo);
      else grouped[photo.barber_id] = [photo];
    }
    setPhotos(grouped);
  }, [user.id]);

  useEffect(() => {
    void loadBarbers();
  }, [loadBarbers]);

  async function handleSavePayout(event: React.FormEvent) {
    event.preventDefault();
    setPayoutError(null);
    setPayoutMessage(null);

    if (!onboardingComplete) {
      setPayoutError("店名、匯款戶名與匯款帳號都是必填。All three fields are required.");
      return;
    }

    setSavingPayout(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bank_account_name: bankName.trim(),
        bank_account_number: bankNumber.trim(),
      })
      .eq("id", user.id);
    setSavingPayout(false);

    if (error) {
      setPayoutError(error.message);
      return;
    }

    await refreshProfile();
    setPayoutMessage("已儲存 / Saved");
  }

  async function handleCreateBarber(event: React.FormEvent) {
    event.preventDefault();
    setBarberError(null);

    if (newBarber.name.trim() === "") {
      setBarberError("理髮師名稱是必填。A barber needs a name.");
      return;
    }

    setCreatingBarber(true);
    const { error } = await supabase.from("barbers").insert({
      shop_id: user.id,
      name: newBarber.name.trim(),
      intro: newBarber.intro.trim() || null,
      address: newBarber.address.trim() || null,
    });
    setCreatingBarber(false);

    if (error) {
      setBarberError(error.message);
      return;
    }

    setNewBarber(emptyBarberForm);
    await loadBarbers();
  }

  function startEditing(barber: Barber) {
    setEditingId(barber.id);
    setEditForm({
      name: barber.name,
      intro: barber.intro ?? "",
      address: barber.address ?? "",
    });
  }

  async function handleSaveEdit(barberId: string) {
    setBarberError(null);

    if (editForm.name.trim() === "") {
      setBarberError("理髮師名稱是必填。A barber needs a name.");
      return;
    }

    const { error } = await supabase
      .from("barbers")
      .update({
        name: editForm.name.trim(),
        intro: editForm.intro.trim() || null,
        address: editForm.address.trim() || null,
      })
      .eq("id", barberId);

    if (error) {
      setBarberError(error.message);
      return;
    }

    setEditingId(null);
    await loadBarbers();
  }

  async function handleDeleteBarber(barber: Barber) {
    setBarberError(null);

    // Remove the barber's photo objects first — deleting the row cascades the metadata
    // but Storage keeps its files unless we clear them explicitly.
    const barberPhotos = photos[barber.id] ?? [];
    if (barberPhotos.length > 0) {
      await supabase.storage.from(PHOTO_BUCKET).remove(barberPhotos.map((p) => p.storage_path));
    }

    const { error } = await supabase.from("barbers").delete().eq("id", barber.id);
    if (error) {
      setBarberError(error.message);
      return;
    }
    await loadBarbers();
  }

  async function handleUploadPhotos(barberId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPhotoError(null);
    setUploadingFor(barberId);

    const existing = photos[barberId] ?? [];
    let sortOrder = existing.length;

    for (const file of Array.from(fileList)) {
      // The path's first segment MUST be the barber id — that is what the Storage
      // policy checks ownership against, so barber A cannot write into barber B's folder.
      const path = `${barberId}/${crypto.randomUUID()}.${fileExtension(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setPhotoError(uploadError.message);
        break;
      }

      const { error: insertError } = await supabase.from("barber_photos").insert({
        barber_id: barberId,
        storage_path: path,
        sort_order: sortOrder,
      });

      if (insertError) {
        // Don't leave an orphan object behind if the metadata row failed.
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        setPhotoError(insertError.message);
        break;
      }

      sortOrder += 1;
    }

    setUploadingFor(null);
    await loadBarbers();
  }

  async function handleToggleFeatured(photo: BarberPhoto) {
    setPhotoError(null);
    const { error } = await supabase
      .from("barber_photos")
      .update({ is_featured: !photo.is_featured })
      .eq("id", photo.id);

    if (error) {
      setPhotoError(error.message);
      return;
    }
    await loadBarbers();
  }

  async function handleDeletePhoto(photo: BarberPhoto) {
    setPhotoError(null);

    // Delete BOTH the Storage object and its metadata row.
    const { error: removeError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([photo.storage_path]);
    if (removeError) {
      setPhotoError(removeError.message);
      return;
    }

    const { error } = await supabase.from("barber_photos").delete().eq("id", photo.id);
    if (error) {
      setPhotoError(error.message);
      return;
    }
    await loadBarbers();
  }

  return (
    <div className="min-h-screen bg-cream">
      <ShopNav email={user.email} />

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">理髮店上架 / Shop onboarding</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            填好撥款設定、建立你的理髮師（可以有很多位），再上傳他們的作品照。
          </p>
        </div>

        {!onboardingComplete && (
          <p className="rounded-2xl border border-border bg-accent/40 px-5 py-4 text-sm">
            還沒完成開店：<strong>店名、匯款戶名、匯款帳號</strong> 三個欄位都填好並儲存後才算完成。
          </p>
        )}

        {/* ── A. Payout settings ───────────────────────────────────────── */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <h2 className="font-display text-2xl">撥款設定 / Payout settings</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            店家層級的設定，這間店所有理髮師共用。先用測試資料即可 / use test data first.
          </p>

          <form onSubmit={handleSavePayout} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="display-name" className="text-sm font-medium">
                店名 Shop name <span className="text-destructive">*</span>
              </label>
              <input
                id="display-name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Downtown Cuts"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                你的理髮店名稱，會顯示在撥款紀錄上 / your shop&apos;s name, shown on payout records.
                這是店名，不是理髮師的名字。
              </p>
            </div>

            <div>
              <label htmlFor="bank-name" className="text-sm font-medium">
                匯款戶名 Bank account name <span className="text-destructive">*</span>
              </label>
              <input
                id="bank-name"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="bank-number" className="text-sm font-medium">
                匯款帳號 Bank account number <span className="text-destructive">*</span>
              </label>
              <input
                id="bank-number"
                required
                value={bankNumber}
                onChange={(e) => setBankNumber(e.target.value)}
                className={inputClass}
              />
            </div>

            <p className="text-xs text-muted-foreground sm:col-span-2">
              你的理髮店收款的銀行帳戶 / the bank account where your shop gets paid.
              只有你自己看得到。
            </p>

            <div className="flex items-center gap-4 sm:col-span-2">
              <button
                type="submit"
                disabled={savingPayout || !onboardingComplete}
                className={primaryButton}
              >
                {savingPayout ? "儲存中…" : "儲存 / Save"}
              </button>
              {payoutMessage && (
                <span className="text-sm text-muted-foreground">{payoutMessage}</span>
              )}
              {payoutError && <span className="text-sm text-destructive">{payoutError}</span>}
            </div>
          </form>
        </section>

        {/* ── B. My barbers ────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <h2 className="font-display text-2xl">我的理髮師 / My barbers</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            一間店可以有很多位理髮師 — 想加幾位就加幾位。
          </p>

          {barberError && <p className="mt-4 text-sm text-destructive">{barberError}</p>}

          <div className="mt-6 space-y-4">
            {!barbersLoaded && <p className="text-sm text-muted-foreground">載入中…</p>}

            {barbersLoaded && barbers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                還沒有理髮師。用下面的表單新增第一位。
              </p>
            )}

            {barbers.map((barber) => {
              const barberPhotos = photos[barber.id] ?? [];
              const isEditing = editingId === barber.id;

              return (
                <article key={barber.id} className="rounded-2xl border border-border p-5">
                  {isEditing ? (
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm font-medium" htmlFor={`name-${barber.id}`}>
                          名稱 Name
                        </label>
                        <input
                          id={`name-${barber.id}`}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`intro-${barber.id}`}>
                          簡介 Intro
                        </label>
                        <textarea
                          id={`intro-${barber.id}`}
                          rows={3}
                          value={editForm.intro}
                          onChange={(e) => setEditForm({ ...editForm, intro: e.target.value })}
                          className={textareaClass}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`address-${barber.id}`}>
                          地址 Address
                        </label>
                        <input
                          id={`address-${barber.id}`}
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(barber.id)}
                          className={secondaryButton}
                        >
                          儲存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={secondaryButton}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-medium">{barber.name}</h3>
                        {barber.intro && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {barber.intro}
                          </p>
                        )}
                        {barber.address && (
                          <p className="mt-1 text-sm text-muted-foreground">{barber.address}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(barber)}
                          className={secondaryButton}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBarber(barber)}
                          className={secondaryButton}
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── C. Sample hairstyle photos for this barber ──────── */}
                  <div className="mt-5 border-t border-border/60 pt-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-sm font-medium">作品照 / Sample hairstyle photos</h4>
                      <label className={`${secondaryButton} cursor-pointer leading-9`}>
                        {uploadingFor === barber.id ? "上傳中…" : "上傳照片"}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploadingFor !== null}
                          onChange={(e) => {
                            void handleUploadPhotos(barber.id, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {barberPhotos.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        還沒有作品照。上傳這位理髮師過去的髮型作品。
                      </p>
                    ) : (
                      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {barberPhotos.map((photo) => (
                          <li
                            key={photo.id}
                            className="overflow-hidden rounded-xl border border-border"
                          >
                            <img
                              src={publicPhotoUrl(photo.storage_path)}
                              alt={photo.caption ?? `${barber.name} 的作品`}
                              loading="lazy"
                              className="aspect-square w-full object-cover"
                            />
                            <div className="flex items-center justify-between gap-2 px-3 py-2">
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={photo.is_featured}
                                  onChange={() => void handleToggleFeatured(photo)}
                                />
                                精選
                              </label>
                              <button
                                type="button"
                                onClick={() => void handleDeletePhoto(photo)}
                                className="text-xs text-muted-foreground underline underline-offset-2"
                              >
                                刪除
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {photoError && <p className="mt-4 text-sm text-destructive">{photoError}</p>}

          <form
            onSubmit={handleCreateBarber}
            className="mt-6 grid gap-4 rounded-2xl border border-dashed border-border p-5"
          >
            <h3 className="text-sm font-medium">新增一位理髮師 / Add another barber</h3>
            <div>
              <label htmlFor="new-name" className="text-sm font-medium">
                名稱 Name <span className="text-destructive">*</span>
              </label>
              <input
                id="new-name"
                required
                value={newBarber.name}
                onChange={(e) => setNewBarber({ ...newBarber, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="new-intro" className="text-sm font-medium">
                簡介 Intro
              </label>
              <textarea
                id="new-intro"
                rows={3}
                value={newBarber.intro}
                onChange={(e) => setNewBarber({ ...newBarber, intro: e.target.value })}
                placeholder="簡短介紹一下這位理髮師 / a short bio"
                className={textareaClass}
              />
            </div>
            <div>
              <label htmlFor="new-address" className="text-sm font-medium">
                地址 Address
              </label>
              <input
                id="new-address"
                value={newBarber.address}
                onChange={(e) => setNewBarber({ ...newBarber, address: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <button type="submit" disabled={creatingBarber} className={primaryButton}>
                {creatingBarber ? "新增中…" : "新增理髮師"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
