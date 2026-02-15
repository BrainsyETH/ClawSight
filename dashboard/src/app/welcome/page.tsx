"use client";

import Link from "next/link";
import {
  Zap,
  Shield,
  Activity,
  User,
  Coins,
  Github,
  Wallet,
  Puzzle,
  Settings,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Zap,
    title: "Skill Management",
    description:
      "Configure and monitor your agent's skills with an intuitive interface. Toggle abilities on and off in real-time.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "Your secrets are encrypted client-side before they ever leave your browser. We can't see your API keys, even if we wanted to.",
  },
  {
    icon: Activity,
    title: "Real-Time Activity",
    description:
      "Watch your agent work in real-time. Every tool call, message, and payment logged and filterable.",
  },
  {
    icon: User,
    title: "Character Driven",
    description:
      "Mrs. Claws is your default agent persona. Customize her name, avatar, and personality — or switch to Professional mode.",
  },
  {
    icon: Coins,
    title: "x402 Micropayments",
    description:
      "Pay-per-use with USDC on Base L2. No subscriptions, no surprises. Track every cent your agent spends.",
  },
  {
    icon: Github,
    title: "Open Source",
    description:
      "Built on OpenClaw, the open-source AI agent framework. Extend with community plugins or build your own.",
  },
];

const steps = [
  {
    icon: Wallet,
    step: "1",
    title: "Connect your wallet",
    description:
      "Sign in securely with your Ethereum wallet using SIWE. No emails, no passwords.",
  },
  {
    icon: Puzzle,
    step: "2",
    title: "Install the OpenClaw plugin",
    description:
      "Add the OpenClaw browser extension to connect your agent to ClawSight.",
  },
  {
    icon: Settings,
    step: "3",
    title: "Configure skills and watch your agent work",
    description:
      "Toggle skills, set budgets, and monitor your agent in real-time from the dashboard.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-50 via-transparent to-transparent opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
              Give her a name.{" "}
              <span className="text-red-500">Teach her skills.</span>{" "}
              Watch her work.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              ClawSight is the control panel for your OpenClaw AI agent.
              Configure skills, monitor activity, and manage spending — all from
              one dashboard.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="text-base px-8">
                <Link href="/onboarding">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8">
                <Link
                  href="https://github.com/openclaw"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-5 w-5" />
                  View on GitHub
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Everything you need to manage your AI agent
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              A powerful dashboard designed around transparency, control, and
              privacy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className={cn(
                  "group transition-all duration-200 hover:shadow-md hover:border-red-200"
                )}
              >
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Get up and running in minutes, not hours.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/25">
                  <step.icon className="h-7 w-7" />
                </div>
                <div className="mb-2 text-sm font-semibold text-red-500 uppercase tracking-wide">
                  Step {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Button asChild size="lg" className="text-base px-8">
              <Link href="/onboarding">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <span className="text-lg font-bold text-gray-900">
                ClawSight
              </span>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                The character-driven control panel for your OpenClaw AI agent.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Product
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/onboarding"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/onboarding"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/onboarding"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Skills
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Resources
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="https://github.com/openclaw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://github.com/openclaw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://github.com/openclaw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Community
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Legal
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="#"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-gray-200 pt-6 text-center">
            <p className="text-sm text-gray-400">
              Built on OpenClaw. Open source and community driven.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
