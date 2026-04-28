import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";

type Props = {
  name: string | null;
  image: string | null;
  eventsCount: number;
};

export function HeroGreeting({ name, image, eventsCount }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl brand-gradient p-6 md:p-8 text-white">
      <div className="absolute inset-0 confetti opacity-30" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-sm opacity-90">{formatDate(new Date(), { weekday: "long" })}</div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">
            {greeting()}, {name?.split(" ")[0] || "human"} 👋
          </h1>
          <p className="mt-2 text-sm md:text-base text-white/90 max-w-lg">
            You&apos;ve had {eventsCount} moment{eventsCount === 1 ? "" : "s"} in your SIB journey so far. Make today
            one to remember.
          </p>
        </div>
        <Avatar src={image} name={name} size="lg" className="ring-4" />
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
