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

export type ClientBoardTask = {
  id: string;
  stageId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  assignedTo: ClientTaskAssignee;
  assignedBy: ClientTaskAssignee | null;
  attachments: ClientTaskAttachment[];
  comments: ClientTaskComment[];
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
  tasks: ClientBoardTask[];
};
