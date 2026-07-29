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

export type EmployeeJourney = {
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
