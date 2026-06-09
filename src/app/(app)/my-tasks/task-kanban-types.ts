export type ClientTaskAuthor = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  image: string | null;
};

export type ClientTaskAssignee = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  image: string | null;
};

export type ClientTaskComment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: ClientTaskAuthor;
};

export type ClientTaskAttachment = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type ClientBoardLabel = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type ClientTaskChecklistItem = {
  id: string;
  body: string;
  isDone: boolean;
  sortOrder: number;
};

export type ClientTaskChecklist = {
  id: string;
  title: string;
  items: ClientTaskChecklistItem[];
};

export type ClientRelatedTaskCopy = {
  id: string;
  assignedTo: ClientTaskAssignee;
  stage: { title: string; isFinishedColumn: boolean };
};

export type ClientBoardTask = {
  id: string;
  stageId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  sortOrder: number;
  assignmentGroupId: string | null;
  assignedTo: ClientTaskAssignee;
  assignedBy: ClientTaskAssignee | null;
  attachments: ClientTaskAttachment[];
  comments: ClientTaskComment[];
  members: ClientTaskAssignee[];
  labels: { id: string; name: string; color: string }[];
  checklists: ClientTaskChecklist[];
};

export type ClientBoardStage = {
  id: string;
  title: string;
  sortOrder: number;
  isFinishedColumn: boolean;
};

export type ClientBoard = {
  id: string;
  updatedAtMs: number;
  stages: ClientBoardStage[];
  labels: ClientBoardLabel[];
  tasks: ClientBoardTask[];
};
