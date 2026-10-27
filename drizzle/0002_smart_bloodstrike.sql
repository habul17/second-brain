ALTER TABLE "topics" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topics_parent_idx" ON "topics" USING btree ("parent_id");