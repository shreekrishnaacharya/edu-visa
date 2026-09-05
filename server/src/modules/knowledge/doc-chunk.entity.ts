import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Doc, DocType } from './doc.entity';

/**
 * One embedded, retrievable chunk of a `doc` (RAG Tier 2). `embedding` is a
 * pgvector `vector(1536)` column managed via raw SQL (see migrations) — the
 * `pgvector` npm package's recommended TypeORM recipe: map it as a plain
 * string column and let Postgres cast the `pgvector.toSql()` literal on
 * write; never let TypeORM try to synchronize/alter its real type.
 */
@Entity('doc_chunk')
export class DocChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  doc_id: string;

  @ManyToOne(() => Doc, (d) => d.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doc_id' })
  doc: Doc;

  @Column({ type: 'int' })
  chunk_index: number;

  @Column({ type: 'text' })
  text: string;

  /** pgvector `vector(1536)` — see class doc comment. */
  @Column()
  embedding: string;

  // denormalised retrieval-filter metadata (mirrors `doc`, avoids a join)
  @Column({ type: 'varchar', length: 2, default: 'AU' })
  @Index()
  country: string;

  @Column({ type: 'varchar' })
  doc_type: DocType;

  @Column({ type: 'varchar', nullable: true })
  institution: string | null;

  @Column({ type: 'date', nullable: true })
  effective_date: string | null;

  @Column()
  source_url: string;
}
