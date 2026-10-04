import type { Condition } from "../engine/conditions";
import type { AdvisorId } from "../engine/policies";

export interface BriefingLine {
  when?: Condition[];
  text: string;
}

export interface Advisor {
  id: AdvisorId;
  name: string;
  title: string;
  bias: string;
  briefing: BriefingLine[];
}

export const ADVISORS: Record<AdvisorId, Advisor> = {
  finance: {
    id: "finance",
    name: "Mrs. Ngozi Adeyemi",
    title: "Finance Adviser",
    bias: "Cautious and treasury-obsessed",
    briefing: [
      {
        when: [{ type: "national", field: "treasury", op: "<", value: 200 }],
        text: "The treasury is nearly empty. Every naira you promise this quarter is a naira we will borrow.",
      },
      {
        when: [{ type: "national", field: "debt", op: ">", value: 4500 }],
        text: "Debt service is eating the budget. Please do not add running costs this quarter.",
      },
      {
        when: [{ type: "national", field: "inflation", op: ">", value: 20 }],
        text: "Inflation is above 20 percent. Spending more will make it worse.",
      },
      {
        text: "We are balanced for now. A small surplus buffer would let me sleep.",
      },
    ],
  },
  security: {
    id: "security",
    name: "Brig. Gen. Ekong Salihu (rtd)",
    title: "Security Adviser",
    bias: "Hawkish; wants budget and force",
    briefing: [
      {
        when: [{ type: "avg", stat: "security", op: "<", value: 40 }],
        text: "Security is weak across too many states. Raise the security share before the next incident forces us to.",
      },
      {
        when: [{ type: "avg", stat: "insurgencyRisk", op: ">", value: 40 }],
        text: "Risk levels are rising in the hotspots. Patrols cost less than funerals.",
      },
      {
        text: "Things are quiet, which is exactly when budgets get cut and trouble gets started.",
      },
    ],
  },
  health: {
    id: "health",
    name: "Dr. Hauwa Okonkwo",
    title: "Health Adviser",
    bias: "Earnest and constantly under-funded",
    briefing: [
      {
        when: [{ type: "avg", stat: "health", op: "<", value: 40 }],
        text: "Clinics are running out of basics. A larger health share now saves far more later.",
      },
      {
        when: [{ type: "avg", stat: "power", op: "<", value: 35 }],
        text: "Hospitals are running on generators. Power and health are the same problem.",
      },
      {
        text: "Health is stable, but one outbreak would expose how thin the margin is.",
      },
    ],
  },
  politics: {
    id: "politics",
    name: "Chief Femi Garuba",
    title: "Political Adviser",
    bias: "A schemer who thinks in votes and loyalty",
    briefing: [
      {
        when: [
          { type: "national", field: "assemblySupport", op: "<", value: 45 },
        ],
        text: "The Assembly is restless. A few constituency projects would calm it down quickly.",
      },
      {
        when: [{ type: "national", field: "approval", op: "<", value: 40 }],
        text: "Your approval is sliding. People want to see something, anything, in their street.",
      },
      {
        text: "Governors are watching who gets funded. Loyalty is a currency; spend it on purpose.",
      },
    ],
  },
};
