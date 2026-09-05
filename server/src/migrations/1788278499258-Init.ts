import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1788278499258 implements MigrationInterface {
    name = 'Init1788278499258'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "scholarship" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_id" uuid NOT NULL, "name" character varying NOT NULL, "pct" numeric NOT NULL DEFAULT '0', "criteria" text NOT NULL DEFAULT '', "min_gpa" numeric NOT NULL DEFAULT '0', CONSTRAINT "PK_90ab4b7111faf40fd3c788eac7b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "course_intake" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_id" uuid NOT NULL, "term" character varying NOT NULL, "intake_date" date NOT NULL, "application_deadline" date NOT NULL, CONSTRAINT "PK_313bb2d2852070b56019ac4dcfc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "course" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "university_id" uuid NOT NULL, "university_name" character varying NOT NULL, "country" character varying(2) NOT NULL, "city" character varying NOT NULL, "world_rank" integer NOT NULL DEFAULT '999', "title" character varying NOT NULL, "degree_level" character varying NOT NULL, "field" character varying NOT NULL, "duration_months" integer NOT NULL, "tuition_fee" numeric NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'AUD', "intakes" text array NOT NULL DEFAULT '{}', "next_intake_date" date NOT NULL, "application_deadline" date NOT NULL, "entry" jsonb NOT NULL DEFAULT '{"min_gpa":0,"min_english_band":0,"accepted_tests":["IELTS","PTE","TOEFL"],"prerequisites":[],"work_experience_months":0}', "career_outcomes" text array NOT NULL DEFAULT '{}', "cricos" character varying, "verified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bf95180dd756fd204fb01ce4916" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_58bd3c945e8e4c1fe3e32e163a" ON "course" ("country", "degree_level", "field") `);
        await queryRunner.query(`CREATE TABLE "university" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "country" character varying(2) NOT NULL, "city" character varying NOT NULL, "world_rank" integer NOT NULL DEFAULT '999', "logo_hue" integer NOT NULL DEFAULT '210', "verified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d14e5687dbd51fd7a915c22ac13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "academic_record" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "level" character varying NOT NULL, "course" character varying NOT NULL, "institution" character varying NOT NULL DEFAULT '', "country" character varying NOT NULL DEFAULT '', "start_year" integer NOT NULL DEFAULT '0', "end_year" integer NOT NULL DEFAULT '0', "gpa_value" numeric NOT NULL DEFAULT '0', "gpa_scale" character varying NOT NULL DEFAULT '4.0', "gap_months" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_66ecd32607661f84d3094b4d650" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "language_test" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "test" character varying NOT NULL, "overall" numeric NOT NULL, "listening" numeric, "reading" numeric, "writing" numeric, "speaking" numeric, "test_date" date, CONSTRAINT "PK_4f92cdcc267bac801f85f24e622" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "career_goal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "target_occupation" character varying NOT NULL DEFAULT '', "target_industry" character varying NOT NULL DEFAULT '', "intended_field" character varying NOT NULL DEFAULT '', "reason" text NOT NULL DEFAULT '', "change_field" boolean NOT NULL DEFAULT false, "long_term" character varying NOT NULL DEFAULT 'employment', CONSTRAINT "REL_8b845372d29b732f9d9afe237b" UNIQUE ("student_id"), CONSTRAINT "PK_bb068381038ee7a82a83d66770a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "income_source" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "kind" character varying NOT NULL DEFAULT 'other', "amount" text NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "evidence" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_16d71b32c4cb3b2c3e9b6367ec5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "kind" character varying NOT NULL DEFAULT 'other', "amount" text NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "liquid" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_1209d107fe21482beaea51b745e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "liability" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "kind" character varying NOT NULL DEFAULT '', "amount" text NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "monthly_repayment" text, CONSTRAINT "PK_42689000082a60d1e150017ef63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sponsor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "relationship" character varying NOT NULL DEFAULT '', "occupation" character varying NOT NULL DEFAULT '', "annual_income" text NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "evidence" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_31c4354cde945c685aabe017541" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "visa_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "country" text NOT NULL, "visa_type" text NOT NULL, "outcome" character varying NOT NULL DEFAULT 'granted', "decision_date" date, "refusal_reason" text, CONSTRAINT "PK_524448cddd34fb804506abc0496" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dependant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "relationship" character varying NOT NULL DEFAULT 'other', "full_name" character varying NOT NULL DEFAULT '', "date_of_birth" date, "accompanying" boolean NOT NULL DEFAULT false, "passport_status" character varying NOT NULL DEFAULT 'none', CONSTRAINT "PK_ab34cf9f2d171ac66b930a93062" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "preferred_countries" text array NOT NULL DEFAULT '{}', "preferred_cities" text array NOT NULL DEFAULT '{}', "degree_level" character varying NOT NULL DEFAULT 'Master', "field" character varying NOT NULL DEFAULT '', "max_tuition_per_year" numeric NOT NULL DEFAULT '0', "tuition_currency" character varying(3) NOT NULL DEFAULT 'AUD', "intake" character varying NOT NULL DEFAULT '', "scholarship_required" boolean NOT NULL DEFAULT false, "min_scholarship_pct" numeric NOT NULL DEFAULT '0', "ranking_matters" boolean NOT NULL DEFAULT false, "city_size" character varying NOT NULL DEFAULT 'either', "cost_sensitivity" character varying NOT NULL DEFAULT 'high', "part_time_work_important" boolean NOT NULL DEFAULT false, CONSTRAINT "REL_40445569e9f89d333353569155" UNIQUE ("student_id"), CONSTRAINT "PK_17f8855e4145192bbabd91a51be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "student" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying NOT NULL, "date_of_birth" date, "gender" character varying NOT NULL DEFAULT 'other', "nationality" character varying NOT NULL DEFAULT '', "current_city" character varying NOT NULL DEFAULT '', "passport_status" character varying NOT NULL DEFAULT 'none', "passport_number" text, "marital_status" character varying NOT NULL DEFAULT 'single', "state" character varying NOT NULL DEFAULT 'Enquiry', "branch_id" uuid, "counsellor_id" uuid, "counsellor" character varying NOT NULL DEFAULT '', "branch" character varying NOT NULL DEFAULT '', "consent_given_at" TIMESTAMP WITH TIME ZONE, "consent_version" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d8016e1cb58429474a3c041904" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7229cd125478963e0c18bf3372" ON "student" ("branch_id", "counsellor_id") `);
        await queryRunner.query(`CREATE TABLE "work_experience" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "title" character varying NOT NULL, "employer" character varying NOT NULL DEFAULT '', "industry" character varying NOT NULL DEFAULT '', "country" character varying NOT NULL DEFAULT '', "start_date" date NOT NULL, "end_date" date, "full_time" boolean NOT NULL DEFAULT true, "relevant" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_d4bef63ad6da7ec327515c121bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fx_rate" ("currency" character varying(3) NOT NULL, "to_aud" numeric NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6751a85e439215da8f9e6d45c31" PRIMARY KEY ("currency"))`);
        await queryRunner.query(`CREATE TABLE "student_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying NOT NULL, "version" integer NOT NULL, "canonical_gpa" numeric NOT NULL DEFAULT '0', "english_band" numeric, "english_source" character varying NOT NULL DEFAULT 'no test on file', "relevant_experience_months" integer NOT NULL DEFAULT '0', "annual_household_income_aud" numeric NOT NULL DEFAULT '0', "available_funds_aud" numeric NOT NULL DEFAULT '0', "affordability_score" numeric NOT NULL DEFAULT '0', "pr_intent" character varying NOT NULL DEFAULT 'low', "highest_level" character varying, "field_of_study" character varying NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_48e055651592504b63f3910d204" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9b950700267080b945b072492c" ON "student_profile" ("student_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dbc74be21df6bf0c3f5746cd61" ON "student_profile" ("student_id", "version") `);
        await queryRunner.query(`CREATE TABLE "match_run" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying NOT NULL, "profile_version" integer NOT NULL, "engine_version" character varying NOT NULL, "weights" jsonb NOT NULL, "results" jsonb NOT NULL DEFAULT '[]', "profile" jsonb NOT NULL, "created_by" character varying NOT NULL DEFAULT '', "conversation_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cc817fe400873d2c4664c5daef5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f77388fc6926fb4be81ded5bc8" ON "match_run" ("student_id") `);
        await queryRunner.query(`CREATE TABLE "follow_up" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying NOT NULL, "kind" character varying NOT NULL DEFAULT 'note', "body" text NOT NULL DEFAULT '', "author" character varying NOT NULL DEFAULT '', "attachments" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5c0a5f5b32937e47e0ab09d596c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6b21248ce797e198fa10b2750e" ON "follow_up" ("student_id") `);
        await queryRunner.query(`CREATE TABLE "student_document" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" character varying NOT NULL, "doc_type" character varying NOT NULL, "remark" text NOT NULL DEFAULT '', "file" jsonb NOT NULL, "uploaded_by" character varying NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2c9db77bec5d1700ab0db7d6476" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_86ce3c5fe4bd92f09f9781f036" ON "student_document" ("student_id") `);
        await queryRunner.query(`CREATE TABLE "app_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying NOT NULL DEFAULT '', "role" character varying NOT NULL DEFAULT 'counsellor', "branch_id" uuid, "branch" character varying NOT NULL DEFAULT '', "permissions" text array NOT NULL DEFAULT '{}', "student_id" uuid, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3fa909d0e37c531ebc237703391" UNIQUE ("email"), CONSTRAINT "PK_22a5c4a3d9b2fb8e4e73fc4ada1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3fa909d0e37c531ebc23770339" ON "app_user" ("email") `);
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "user_email" character varying NOT NULL DEFAULT '', "student_id" character varying NOT NULL, "action" character varying NOT NULL, "ip" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cb11bd5b662431ea0ac455a27d" ON "audit_log" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_97f3d4d7472f2f13c4984608d1" ON "audit_log" ("student_id") `);
        await queryRunner.query(`CREATE TABLE "conversation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid, "started_by" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_864528ec4274360a40f66c29845" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0c1cdc5bddf0193c179a385dd3" ON "conversation" ("student_id") `);
        await queryRunner.query(`CREATE TABLE "message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "role" character varying NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba01f0a3e0123651915008bc578" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "scholarship" ADD CONSTRAINT "FK_6649f487e9769569681b23b35b5" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course_intake" ADD CONSTRAINT "FK_f8ba9347bbe752a1b37d69d5c46" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course" ADD CONSTRAINT "FK_c4a012bebacccd486511a11d90b" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "academic_record" ADD CONSTRAINT "FK_deb745e113b5d66367ea91063a1" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "language_test" ADD CONSTRAINT "FK_cdc1c15c6a90a87c0188c14ce12" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "career_goal" ADD CONSTRAINT "FK_8b845372d29b732f9d9afe237b5" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "income_source" ADD CONSTRAINT "FK_bb0fb23175e040ab4bd6824568d" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset" ADD CONSTRAINT "FK_d53902f062496d9772e7e5da167" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "liability" ADD CONSTRAINT "FK_0659d72ef097e24ec7d4a935076" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sponsor" ADD CONSTRAINT "FK_4552c5dc984fa880411b18f3cba" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "visa_history" ADD CONSTRAINT "FK_86744871833c0fa7409da3832fa" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dependant" ADD CONSTRAINT "FK_1b2c1bcb34a7179439686f8367c" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "preferences" ADD CONSTRAINT "FK_40445569e9f89d3333535691551" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_experience" ADD CONSTRAINT "FK_77aec7f61467df7591ee03ae2c5" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_7fe3e887d78498d9c9813375ce2" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_7fe3e887d78498d9c9813375ce2"`);
        await queryRunner.query(`ALTER TABLE "work_experience" DROP CONSTRAINT "FK_77aec7f61467df7591ee03ae2c5"`);
        await queryRunner.query(`ALTER TABLE "preferences" DROP CONSTRAINT "FK_40445569e9f89d3333535691551"`);
        await queryRunner.query(`ALTER TABLE "dependant" DROP CONSTRAINT "FK_1b2c1bcb34a7179439686f8367c"`);
        await queryRunner.query(`ALTER TABLE "visa_history" DROP CONSTRAINT "FK_86744871833c0fa7409da3832fa"`);
        await queryRunner.query(`ALTER TABLE "sponsor" DROP CONSTRAINT "FK_4552c5dc984fa880411b18f3cba"`);
        await queryRunner.query(`ALTER TABLE "liability" DROP CONSTRAINT "FK_0659d72ef097e24ec7d4a935076"`);
        await queryRunner.query(`ALTER TABLE "asset" DROP CONSTRAINT "FK_d53902f062496d9772e7e5da167"`);
        await queryRunner.query(`ALTER TABLE "income_source" DROP CONSTRAINT "FK_bb0fb23175e040ab4bd6824568d"`);
        await queryRunner.query(`ALTER TABLE "career_goal" DROP CONSTRAINT "FK_8b845372d29b732f9d9afe237b5"`);
        await queryRunner.query(`ALTER TABLE "language_test" DROP CONSTRAINT "FK_cdc1c15c6a90a87c0188c14ce12"`);
        await queryRunner.query(`ALTER TABLE "academic_record" DROP CONSTRAINT "FK_deb745e113b5d66367ea91063a1"`);
        await queryRunner.query(`ALTER TABLE "course" DROP CONSTRAINT "FK_c4a012bebacccd486511a11d90b"`);
        await queryRunner.query(`ALTER TABLE "course_intake" DROP CONSTRAINT "FK_f8ba9347bbe752a1b37d69d5c46"`);
        await queryRunner.query(`ALTER TABLE "scholarship" DROP CONSTRAINT "FK_6649f487e9769569681b23b35b5"`);
        await queryRunner.query(`DROP TABLE "message"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c1cdc5bddf0193c179a385dd3"`);
        await queryRunner.query(`DROP TABLE "conversation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97f3d4d7472f2f13c4984608d1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb11bd5b662431ea0ac455a27d"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3fa909d0e37c531ebc23770339"`);
        await queryRunner.query(`DROP TABLE "app_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_86ce3c5fe4bd92f09f9781f036"`);
        await queryRunner.query(`DROP TABLE "student_document"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b21248ce797e198fa10b2750e"`);
        await queryRunner.query(`DROP TABLE "follow_up"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f77388fc6926fb4be81ded5bc8"`);
        await queryRunner.query(`DROP TABLE "match_run"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbc74be21df6bf0c3f5746cd61"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b950700267080b945b072492c"`);
        await queryRunner.query(`DROP TABLE "student_profile"`);
        await queryRunner.query(`DROP TABLE "fx_rate"`);
        await queryRunner.query(`DROP TABLE "work_experience"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7229cd125478963e0c18bf3372"`);
        await queryRunner.query(`DROP TABLE "student"`);
        await queryRunner.query(`DROP TABLE "preferences"`);
        await queryRunner.query(`DROP TABLE "dependant"`);
        await queryRunner.query(`DROP TABLE "visa_history"`);
        await queryRunner.query(`DROP TABLE "sponsor"`);
        await queryRunner.query(`DROP TABLE "liability"`);
        await queryRunner.query(`DROP TABLE "asset"`);
        await queryRunner.query(`DROP TABLE "income_source"`);
        await queryRunner.query(`DROP TABLE "career_goal"`);
        await queryRunner.query(`DROP TABLE "language_test"`);
        await queryRunner.query(`DROP TABLE "academic_record"`);
        await queryRunner.query(`DROP TABLE "university"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58bd3c945e8e4c1fe3e32e163a"`);
        await queryRunner.query(`DROP TABLE "course"`);
        await queryRunner.query(`DROP TABLE "course_intake"`);
        await queryRunner.query(`DROP TABLE "scholarship"`);
    }

}
