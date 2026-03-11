-- CreateTable
CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "youtubeUrl" TEXT,
    "status" TEXT NOT NULL,
    "transcript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);
