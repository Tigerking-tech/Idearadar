import { Purchases } from "./purchases";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-mono text-neutral-200">Account</h1>
      <div className="grid gap-6">
        <Purchases />
      </div>
    </div>
  );
} 