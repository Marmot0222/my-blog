CREATE TABLE "article_media_references" (
	"article_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "article_media_references_article_id_revision_media_id_pk" PRIMARY KEY("article_id","revision","media_id")
);
--> statement-breakpoint
ALTER TABLE "article_media_references" ADD CONSTRAINT "article_media_references_article_id_revision_article_revisions_article_id_revision_fk" FOREIGN KEY ("article_id","revision") REFERENCES "public"."article_revisions"("article_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_media_lookup" ON "article_media_references" USING btree ("media_id");