export type MilestoneType =
  | "joining"
  | "promotion"
  | "department_transfer"
  | "training"
  | "certification"
  | "award"
  | "performance_review"
  | "pip_initiated"
  | "pip_closed"
  | "anniversary"
  | "recognition";

export type JourneyMilestone = {
  id: string;
  type: MilestoneType;
  title: string;
  date: string;
  description: string;
  issuedBy?: string;
  thumbnailUrl?: string;
};

export type GrowthPoint = {
  date: string;
  seniorityLevel: number;
  designation: string;
};

export type Certification = {
  id: string;
  name: string;
  issuer: string;
  date: string;
  validUntil?: string;
  imageUrl?: string;
};

export type Award = {
  id: string;
  name: string;
  givenBy: string;
  date: string;
  occasion: string;
};

/** Photo from the company feed where this employee appears in photo tags. */
export type TaggedFeedPhoto = {
  id: string;
  postId: string;
  imageUrl: string;
  postedAt: string;
  postedByName: string;
  caption?: string;
};

export type MockEmployeeJourney = {
  employee: {
    name: string;
    designation: string;
    department: string;
    location: string;
    joinedAt: string;
    companyName: string;
    avatarInitials: string;
    avatarUrl?: string;
  };
  stats: {
    trainingsCompleted: number;
    certificationsEarned: number;
    awardsCount: number;
    designationsHeld: number;
    performanceSummary: string;
  };
  growthCurve: GrowthPoint[];
  seniorityLabels: Record<number, string>;
  milestones: JourneyMilestone[];
  certifications: Certification[];
  awards: Award[];
  taggedFeedPhotos: TaggedFeedPhoto[];
};

export const mockEmployeeJourney: MockEmployeeJourney = {
  employee: {
    name: "Priya Sharma",
    designation: "Senior Learning Associate",
    department: "Academic Operations",
    location: "Noida, India",
    joinedAt: "2023-03-15",
    companyName: "Skillinabox",
    avatarInitials: "PS",
  },
  stats: {
    trainingsCompleted: 5,
    certificationsEarned: 2,
    awardsCount: 3,
    designationsHeld: 3,
    performanceSummary: "3× Exceeds · 1× Meets",
  },
  seniorityLabels: {
    1: "Associate",
    2: "Learning Associate",
    3: "Senior Learning Associate",
    4: "Lead Associate",
  },
  growthCurve: [
    { date: "2023-03-15", seniorityLevel: 1, designation: "Associate — Onboarding" },
    { date: "2024-01-08", seniorityLevel: 2, designation: "Learning Associate" },
    { date: "2024-09-01", seniorityLevel: 3, designation: "Senior Learning Associate" },
  ],
  milestones: [
    {
      id: "m1",
      type: "joining",
      title: "Joined Skillinabox",
      date: "2023-03-15",
      description: "Started as Associate in the Learner Success team.",
      issuedBy: "People Operations",
    },
    {
      id: "m2",
      type: "training",
      title: "Completed Onboarding Excellence Programme",
      date: "2023-06-20",
      description: "Internal bootcamp covering SIB culture, tools, and learner support workflows.",
      issuedBy: "L&D Team",
    },
    {
      id: "m3",
      type: "certification",
      title: "Google Certified Educator — Level 1",
      date: "2023-09-10",
      description: "Validated skills in classroom technology and digital pedagogy.",
      issuedBy: "Google for Education",
    },
    {
      id: "m4",
      type: "award",
      title: "Star Performer — Q3",
      date: "2023-11-05",
      description: "Recognised for exceptional learner NPS and mentor feedback scores.",
      issuedBy: "Academic Leadership",
    },
    {
      id: "m5",
      type: "promotion",
      title: "Promoted to Learning Associate",
      date: "2024-01-08",
      description: "Stepped up to own cohort facilitation and peer coaching responsibilities.",
      issuedBy: "Ananya Mehta",
    },
    {
      id: "m6",
      type: "training",
      title: "Advanced Facilitation Workshop",
      date: "2024-02-14",
      description: "External workshop on inclusive facilitation and difficult conversations.",
      issuedBy: "SkillBridge Academy",
    },
    {
      id: "m7",
      type: "department_transfer",
      title: "Transferred to Academic Operations",
      date: "2024-04-22",
      description: "Moved from Learner Success to Academic Operations to scale programme delivery.",
      issuedBy: "HR Business Partner",
    },
    {
      id: "m8",
      type: "performance_review",
      title: "Annual Review — Exceeds Expectations",
      date: "2024-06-30",
      description: "Consistently delivered above target on learner outcomes and cross-team collaboration.",
      issuedBy: "Ananya Mehta",
    },
    {
      id: "m9",
      type: "recognition",
      title: "Manager Shoutout — Delivery Sprint",
      date: "2024-07-15",
      description: "Thanked publicly for leading a zero-slip curriculum rollout under a tight deadline.",
      issuedBy: "Ananya Mehta",
    },
    {
      id: "m10",
      type: "pip_initiated",
      title: "Performance Improvement Plan — Initiated",
      date: "2024-08-01",
      description: "Focused 60-day plan on response-time SLAs with weekly check-ins.",
      issuedBy: "People Operations",
    },
    {
      id: "m11",
      type: "promotion",
      title: "Promoted to Senior Learning Associate",
      date: "2024-09-01",
      description: "Expanded scope to programme design and junior associate mentoring.",
      issuedBy: "Ananya Mehta",
    },
    {
      id: "m12",
      type: "pip_closed",
      title: "Performance Improvement Plan — Successfully Closed",
      date: "2024-10-01",
      description: "All PIP goals met ahead of schedule; returned to standard review cycle.",
      issuedBy: "People Operations",
    },
    {
      id: "m13",
      type: "certification",
      title: "Instructional Design Professional (IDP)",
      date: "2024-10-05",
      description: "Credential in learning objectives, assessment design, and storyboarding.",
      issuedBy: "ATD India",
    },
    {
      id: "m14",
      type: "award",
      title: "Employee of the Month",
      date: "2024-11-20",
      description: "November spotlight for innovation in async learning modules.",
      issuedBy: "CEO Office",
    },
    {
      id: "m15",
      type: "training",
      title: "Leadership Essentials Cohort",
      date: "2025-01-10",
      description: "Internal leadership track covering feedback, delegation, and stakeholder management.",
      issuedBy: "L&D Team",
    },
    {
      id: "m16",
      type: "anniversary",
      title: "2-Year Work Anniversary",
      date: "2025-03-15",
      description: "Celebrating two years of growth, impact, and community at Skillinabox.",
      issuedBy: "People Operations",
    },
    {
      id: "m17",
      type: "performance_review",
      title: "Mid-Year Review — Exceeds Expectations",
      date: "2025-03-20",
      description: "Strong trajectory on programme quality metrics and team mentorship.",
      issuedBy: "Ananya Mehta",
    },
    {
      id: "m18",
      type: "anniversary",
      title: "1-Year Work Anniversary",
      date: "2024-03-15",
      description: "First year at Skillinabox — thank you for making learners shine.",
      issuedBy: "People Operations",
    },
    {
      id: "m19",
      type: "award",
      title: "Values Champion — Curiosity",
      date: "2025-05-08",
      description: "Nominated by peers for experimenting with AI-assisted lesson planning.",
      issuedBy: "Culture Council",
    },
    {
      id: "m20",
      type: "training",
      title: "Data Literacy for Educators",
      date: "2025-05-22",
      description: "Upskilling on dashboards, cohort analytics, and evidence-based iteration.",
      issuedBy: "L&D Team",
    },
  ],
  certifications: [
    {
      id: "c1",
      name: "Google Certified Educator — Level 1",
      issuer: "Google for Education",
      date: "2023-09-10",
      validUntil: "2026-09-10",
    },
    {
      id: "c2",
      name: "Instructional Design Professional (IDP)",
      issuer: "ATD India",
      date: "2024-10-05",
      validUntil: "2027-10-05",
    },
  ],
  awards: [
    {
      id: "a1",
      name: "Star Performer — Q3",
      givenBy: "Academic Leadership",
      date: "2023-11-05",
      occasion: "Quarterly recognition",
    },
    {
      id: "a2",
      name: "Employee of the Month",
      givenBy: "CEO Office",
      date: "2024-11-20",
      occasion: "November 2024",
    },
    {
      id: "a3",
      name: "Values Champion — Curiosity",
      givenBy: "Culture Council",
      date: "2025-05-08",
      occasion: "Annual values awards",
    },
  ],
  taggedFeedPhotos: [
    {
      id: "tf1",
      postId: "post-team-offsite",
      imageUrl: "https://picsum.photos/seed/sib-offsite/240/320",
      postedAt: "2025-04-12",
      postedByName: "Ananya Mehta",
      caption: "Academic Ops offsite — day one!",
    },
    {
      id: "tf2",
      postId: "post-learner-grad",
      imageUrl: "https://picsum.photos/seed/sib-graduation/240/320",
      postedAt: "2025-03-28",
      postedByName: "Rahul Verma",
      caption: "Cohort 14 graduation ceremony",
    },
    {
      id: "tf3",
      postId: "post-holi",
      imageUrl: "https://picsum.photos/seed/sib-holi/240/320",
      postedAt: "2025-03-14",
      postedByName: "Culture Council",
      caption: "Holi celebrations at Noida campus",
    },
    {
      id: "tf4",
      postId: "post-workshop",
      imageUrl: "https://picsum.photos/seed/sib-workshop/240/320",
      postedAt: "2025-02-20",
      postedByName: "L&D Team",
      caption: "Facilitation workshop group photo",
    },
    {
      id: "tf5",
      postId: "post-townhall",
      imageUrl: "https://picsum.photos/seed/sib-townhall/240/320",
      postedAt: "2025-01-15",
      postedByName: "CEO Office",
      caption: "Q4 town hall — team huddle",
    },
    {
      id: "tf6",
      postId: "post-anniversary",
      imageUrl: "https://picsum.photos/seed/sib-anniversary/240/320",
      postedAt: "2025-03-15",
      postedByName: "People Operations",
      caption: "2-year anniversary shoutout",
    },
    {
      id: "tf7",
      postId: "post-innovation",
      imageUrl: "https://picsum.photos/seed/sib-innovation/240/320",
      postedAt: "2025-05-10",
      postedByName: "Culture Council",
      caption: "Innovation day demo booth",
    },
  ],
};
