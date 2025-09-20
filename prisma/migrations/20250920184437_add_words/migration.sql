-- CreateTable
CREATE TABLE "public"."Word" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "translate" TEXT NOT NULL,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" INTEGER NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Word_text_taskId_key" ON "public"."Word"("text", "taskId");

-- AddForeignKey
ALTER TABLE "public"."Word" ADD CONSTRAINT "Word_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
