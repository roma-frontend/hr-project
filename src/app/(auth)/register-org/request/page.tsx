"use client";

import { useState, useTransition, useEffect } from "react"
import { useTranslation } from 'react-i18next';;
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  Globe,
  Briefcase,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import bcrypt from "bcryptjs";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

const passwordStrength = (pwd: string) => {
  if (pwd.length < 8) return 0;
  let strength = 1;
  if (/[A-Z]/.test(pwd)) strength++;
  if (/[0-9]/.test(pwd)) strength++;
  if (/[^A-Za-z0-9]/.test(pwd)) strength++;
  return strength;
};

const STRENGTH_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#10b981"];
const STRENGTH_LABELS = ["Weak", "Fair", "Good", "Strong"];

const TEAM_SIZES = ["1-10", "11-50", "51-200", "200+"];

export default function RequestOrgPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    orgName: "",
    slug: "",
    userName: "",
    email: "",
    password: "",
    phone: "",
    country: "",
    industry: "",
    teamSize: "",
    description: "",
  });

  const requestOrg = useMutation(api.organizationRequests.requestOrganization);

  const plan = searchParams.get("plan") as "professional" | "enterprise" | null;

  useEffect(() => {
    if (plan !== "professional" && plan !== "enterprise") {
      router.push("/register-org");
    }
  }, [plan, router]);

  // Auto-generate slug from org name
  useEffect(() => {
    if (formData.orgName && !formData.slug) {
      const slug = formData.orgName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 30);
      setFormData((prev) => ({ ...prev, slug }));
    }
  }, [formData.orgName, formData.slug]);

  const strength = passwordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!formData.slug) {
      setError("Organization slug is required");
      return;
    }

    if (!plan) {
      setError("Plan not selected");
      return;
    }

    startTransition(async () => {
      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(formData.password, 10);

        // Create request
        await requestOrg({
          name: formData.orgName,
          slug: formData.slug,
          email: formData.email,
          password: hashedPassword,
          userName: formData.userName,
          phone: formData.phone || undefined,
          plan,
          country: formData.country || undefined,
          industry: formData.industry || undefined,
          teamSize: formData.teamSize || undefined,
          description: formData.description || undefined,
        });

        toast.success("🎉 Request submitted successfully!");
        
        // Redirect to confirmation page
        router.push("/register-org/pending");
      } catch (err: any) {
        setError(err.message || "Failed to submit request");
        toast.error(err.message || "Failed to submit request");
      }
    });
  };

  const planColor = plan === "enterprise" ? "from-purple-500 to-pink-500" : "from-blue-500 to-cyan-500";
  const planIcon = plan === "enterprise" ? Crown : Building2;
  const Icon = planIcon;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--background)" }}
    >
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: `radial-gradient(circle, ${plan === "enterprise" ? "#a855f7" : "#2563eb"}, transparent)` }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: `radial-gradient(circle, ${plan === "enterprise" ? "#ec4899" : "#0ea5e9"}, transparent)` }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-2xl relative"
      >
        <div
          className="rounded-2xl p-8 shadow-2xl border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${planColor})` }}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold capitalize" style={{ color: "var(--text-primary)" }}>
                Request {plan} Plan
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {plan === "enterprise" ? "Custom pricing • 100+ employees" : "$29/mo • Up to 50 employees"} • Approved within 24h
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Organization Details */}
            <div className="space-y-4 p-4 rounded-xl" style={{ background: "rgba(37,99,235,0.05)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Organization Details
              </h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Organization Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    required
                    value={formData.orgName}
                    onChange={(e) => setFormData((p) => ({ ...p, orgName: e.target.value }))}
                    placeholder={t('placeholders.acmeCorporation')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{
                      background: "var(--input)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Organization URL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      }))
                    }
                    placeholder="acme-corp"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{
                      background: "var(--input)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  yourteam.officehub.com/<strong>{formData.slug || "your-org"}</strong>
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Industry
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData((p) => ({ ...p, industry: e.target.value }))}
                      placeholder={t('placeholders.technology')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Team Size
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <select
                      value={formData.teamSize}
                      onChange={(e) => setFormData((p) => ({ ...p, teamSize: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                    >
                      <option value="">Select size</option>
                      {TEAM_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size} employees
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Your Details (Admin Account)
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      required
                      value={formData.userName}
                      onChange={(e) => setFormData((p) => ({ ...p, userName: e.target.value }))}
                      placeholder={t('placeholders.johnDoe')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t('auth.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 234 567 890"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{
                        background: "var(--input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                    placeholder={t('placeholders.unitedStates')}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{
                      background: "var(--input)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    placeholder={t('placeholders.minCharacters')}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{
                      background: "var(--input)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-1 rounded-full transition-all"
                          style={{
                            background: i < strength ? STRENGTH_COLORS[strength - 1] : "var(--border)",
                          }}
                        />
                      ))}
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: strength > 0 ? STRENGTH_COLORS[strength - 1] : "var(--text-muted)" }}
                    >
                      {strength > 0 ? STRENGTH_LABELS[strength - 1] : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Tell us about your needs (optional)
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-[var(--text-muted)]" />
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder={t('placeholders.whatFeaturesImportant')}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all resize-none"
                  style={{
                    background: "var(--input)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = plan === "enterprise" ? "#a855f7" : "#2563eb")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl text-sm"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isPending}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ background: `linear-gradient(135deg, ${planColor})` }}
            >
              {isPending ? (
                <>
                  <ShieldLoader size="xs" variant="inline" className="mr-2" /> Submitting request...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Submit Request
                </>
              )}
            </motion.button>

            <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              We'll review your request and get back to you within 24 hours.
            </p>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link
            href="/register-org"
            className="text-sm hover:underline flex items-center justify-center gap-1"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft className="w-3 h-3" /> {t('ui.backToPlans')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
