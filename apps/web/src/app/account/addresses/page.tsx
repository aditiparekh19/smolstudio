"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import {
  deleteAddressMutation,
  myAddressesQuery,
  saveAddressMutation,
} from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";

type Address = {
  id?: string;
  label: string;
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone: string;
};

const blank: Address = {
  label: "",
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "IN",
  phone: "",
};

const fields: Array<{
  key: keyof Address;
  label: string;
  required?: boolean;
  type?: string;
}> = [
  { key: "label", label: "Label" },
  { key: "recipientName", label: "Full name", required: true },
  { key: "line1", label: "Address line 1", required: true },
  { key: "line2", label: "Address line 2" },
  { key: "city", label: "City", required: true },
  { key: "state", label: "State", required: true },
  { key: "postalCode", label: "PIN code", required: true },
  { key: "countryCode", label: "Country" },
  { key: "phone", label: "Phone number", required: true, type: "tel" },
];

export default function Addresses() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Address[]>([]);
  const [a, setA] = useState<Address>(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows((await apiClient().request<any>(myAddressesQuery)).myAddresses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load addresses.");
    }
  }

  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user]);

  if (loading)
    return <main className="mx-auto max-w-5xl px-5 py-16">Loading…</main>;

  if (!user)
    return (
      <main className="mx-auto max-w-5xl px-5 py-16">
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </main>
    );

  function validatePhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return /^(?:91)?[6-9]\d{9}$/.test(digits);
  }

  function updateField(key: keyof Address, value: string) {
    setA((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  }

  function editAddress(address: Address) {
    setError("");
    setA({
      ...blank,
      ...address,
      id: address.id,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setA(blank);
    setError("");
  }

  async function save() {
    setError("");

    const requiredFields: Array<[keyof Address, string]> = [
      ["recipientName", "Full name"],
      ["line1", "Address line 1"],
      ["city", "City"],
      ["state", "State"],
      ["postalCode", "PIN code"],
      ["phone", "Phone number"],
    ];

    for (const [key, label] of requiredFields) {
      if (!String(a[key] ?? "").trim()) {
        setError(`${label} is required.`);
        return;
      }
    }

    const pin = a.postalCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter a valid 6-digit Indian PIN code.");
      return;
    }

    if (!validatePhone(a.phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setSaving(true);
    try {
      await apiClient().request(saveAddressMutation, {
        ...a,

        label: (a.label ?? "").trim() || undefined,

        recipientName: (a.recipientName ?? "").trim(),

        line1: (a.line1 ?? "").trim(),

        line2: (a.line2 ?? "").trim() || undefined,

        city: (a.city ?? "").trim(),

        state: (a.state ?? "").trim(),

        postalCode: pin,

        countryCode: (a.countryCode ?? "").trim().toUpperCase() || "IN",

        phone: (a.phone ?? "").replace(/\D/g, "").replace(/^91/, ""),
      });

      setA(blank);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save address.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <Link href="/account" className="text-sm text-[#8b7a70]">
        ← Account
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
        Saved addresses
      </h1>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 rounded-[2rem] border border-[#eadfd5] bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-medium text-[#5e473c]">
            {a.id ? "Edit address" : "Add new address"}
          </h2>
          {a.id && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-[#8b7a70] underline"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 ml-1 block text-xs text-[#8b7a70]">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                type={field.type ?? "text"}
                value={String(a[field.key] ?? "")}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.label}
                inputMode={
                  field.key === "phone" || field.key === "postalCode"
                    ? "numeric"
                    : undefined
                }
                maxLength={
                  field.key === "phone"
                    ? 13
                    : field.key === "postalCode"
                      ? 6
                      : undefined
                }
                className="w-full rounded-xl border border-[#d9cbc0] px-4 py-3 outline-none focus:border-[#8b7a70]"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-4 rounded-full bg-[#5e473c] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : a.id ? "Update address" : "Save address"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.map((x) => (
          <div
            key={x.id}
            className="rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-6"
          >
            <p className="font-medium">{x.label || x.recipientName}</p>
            <p className="mt-3 text-sm leading-6">
              {x.recipientName}
              <br />
              {x.line1}
              {x.line2 && (
                <>
                  <br />
                  {x.line2}
                </>
              )}
              <br />
              {x.city}, {x.state} {x.postalCode}
              <br />
              {x.phone || ""}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => editAddress(x)}
                className="rounded-full border border-[#cdbfb5] px-4 py-2 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!x.id) return;
                  if (
                    !confirm(`Delete ${x.label || x.recipientName}'s address?`)
                  )
                    return;
                  try {
                    await apiClient().request(deleteAddressMutation, {
                      id: x.id,
                    });
                    if (a.id === x.id) setA(blank);
                    await load();
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Unable to delete address.",
                    );
                  }
                }}
                className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
