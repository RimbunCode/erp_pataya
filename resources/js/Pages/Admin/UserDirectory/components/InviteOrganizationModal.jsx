import { useForm } from "@inertiajs/react";
import Icon from "@/Components/ui/Icon";

export default function InviteOrganizationModal({ onClose }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    organization_name: "",
    email: "",
    contact_person: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    post(route("admin.user.organizations.invite"), {
      preserveScroll: true,
      only: ["orgs"],
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/70 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon d="M6 18L18 6M6 6l12 12" cls="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Icon
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              cls="w-5 h-5 text-primary-foreground"
            />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
              Invite Organization
            </h2>
            <p className="text-xs text-muted-foreground">
              Send an invitation email to register a new organization
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              value={data.organization_name}
              onChange={(e) => setData("organization_name", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="PT Example Company"
            />
            {errors.organization_name && (
              <p className="text-xs text-destructive mt-1">
                {errors.organization_name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => setData("email", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="admin@company.co.id"
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Contact Person
            </label>
            <input
              type="text"
              value={data.contact_person}
              onChange={(e) => setData("contact_person", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Full name of contact person"
            />
            {errors.contact_person && (
              <p className="text-xs text-destructive mt-1">
                {errors.contact_person}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? "Sending..." : "Send Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
