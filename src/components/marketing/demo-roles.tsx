import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { signInAsDemo } from "@/lib/actions/auth";
import { DEMO_ACCOUNTS, DEMO_ROLES } from "@/lib/demo-accounts";
import { useTranslations } from "next-intl";
import { FC } from "react";

const DemoRoles: FC = () => {
  const t = useTranslations();

  return (
    <section
      aria-labelledby="roles-title"
      className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:py-28"
    >
      <div className="lg:col-span-4">
        <h2
          id="roles-title"
          className="max-w-[14ch] font-display text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-ink [font-variation-settings:'wdth'_84] sm:text-5xl"
        >
          {t("landing.roles.title")}
        </h2>
        <p className="mt-5 max-w-[34ch] text-lg leading-relaxed text-ink-soft">
          {t("landing.roles.body")}
        </p>
      </div>

      <ul className="divide-y divide-border self-start rounded-[8px] border border-border bg-surface shadow-raised lg:col-span-8">
        {DEMO_ROLES.map((role) => {
          const account = DEMO_ACCOUNTS[role];
          const firstName = account.name.split(" ")[0];

          return (
            <li
              key={role}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Avatar
                  name={account.name}
                  tone={role === "customer" ? "customer" : "staff"}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-ink">
                      {account.name}
                    </span>
                    <span className="ml-2 text-ink-soft">
                      {t(`roles.${role}`)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[0.9375rem] text-ink">
                    {t(`landing.roles.${role}Task`)}
                  </p>
                </div>
              </div>
              <form action={signInAsDemo.bind(null, role)}>
                <PendingButton
                  className={buttonClass({
                    variant: role === "customer" ? "primary" : "secondary",
                    className: "w-full sm:w-auto",
                  })}
                >
                  {t("landing.roles.action", { name: firstName })}
                </PendingButton>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default DemoRoles;
