import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">synctip</h1>
        <p className="text-muted-foreground">
          Tailwind v4 + shadcn/ui scaffolded. Edit{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
            src/routes/index.tsx
          </code>{" "}
          to start building.
        </p>
      </section>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Brand check</CardTitle>
          <CardDescription>
            Primary color is set to <code>#1F7A63</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use the toggle in the header to switch light, dark, and system themes.
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={() => toast.success("Hello from sonner")}>
            Show toast
          </Button>
          <Button variant="outline" onClick={() => toast.error("Oops")}>
            Error toast
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
