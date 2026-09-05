# The `@sksharma72000/nestjs-search-page` Handbook

**A complete guide to declarative search, filtering, and pagination for NestJS + TypeORM (MySQL).**

Package version documented: **3.2.4** · License: MIT · Author: Shree Krishna Acharya

---

<a id="preface"></a>

## Preface

### What this package is, in one sentence

`@sksharma72000/nestjs-search-page` lets you describe a REST list endpoint's **entire
query surface** — which fields are filterable, how they compare, which relations to
join, how to paginate and sort — **once, as decorators on a DTO**, and then turns an
incoming URL query string into an executed, paginated database result with a single
function call.

```
GET /students?class_id=7&full_name=ram&class=true&_start=0&_end=20&_sort=roll_no&_order=ASC
```
becomes
```jsonc
{ "elements": [ /* Student[] with .class joined */ ],
  "totalElements": 143,
  "pageable": { "_start": 0, "_end": 20, "_sort": "roll_no", "_order": "ASC" } }
```
with a service method that reads, in full:
```ts
getAll(page: PageDto, search: StudentSearchDto) {
  return findAllByPage<Student>({ repo: this.repo, page, queryDto: search });
}
```

### Who this handbook is for

- **Developers** adding list/search/pagination endpoints to a NestJS + TypeORM service.
- **AI coding agents** that need a precise, self-contained specification to implement
  the same pattern correctly in any NestJS + TypeORM project — Part II is a
  deterministic recipe; Part VII is the exact runtime behaviour.

### How to read it

| If you want to… | Read |
|---|---|
| understand why you'd adopt this at all | **Part I** |
| ship an endpoint in the next 10 minutes | **Part II**, Chapter 7 |
| know every option of every decorator | **Part III** |
| copy a solution to a specific problem | **Part IV** (the Cookbook) |
| bend it to a non-trivial query | **Part V** |
| see how it's really used at scale | **Part VI** |
| reason about exact behaviour / debug | **Part VII** + **Appendix A/B** |

### Conventions

- Code blocks are TypeScript unless labelled otherwise.
- `⚠️` marks a foot-gun that has bitten someone.
- File links such as [`src/common/services/common.service.ts`](src/common/services/common.service.ts)
  point into the **school backend** in this monorepo; [`../nestjs-search-page`](../nestjs-search-page)
  is the package's own source repo.
- "The builder" / "the engine" = the `findOptions()` function, which does all the work.

### Table of contents

Every entry below is a link — click to jump straight to that topic.

- [Preface](#preface)

**[Part I — Why this package exists](#part-i)**
- [Chapter 1 — The problem with list endpoints](#ch1)
- [Chapter 2 — What this package does](#ch2)
- [Chapter 3 — Advantages at a glance](#ch3)
- [Chapter 4 — Before & after, a real comparison](#ch4)
- [Chapter 5 — When to use it, and when to drop to raw TypeORM](#ch5)

**[Part II — Getting started](#part-ii)**
- [Chapter 6 — Installation & prerequisites](#ch6)
- [Chapter 7 — Your first endpoint, in four files](#ch7)
- [Chapter 8 — The request lifecycle](#ch8)

**[Part III — The core model](#part-iii)**
- [Chapter 9 — The three DTOs](#ch9)
- [Chapter 10 — `@PageSearch` in depth](#ch10)
  - [§10.7 — Function `value`: dynamic raw SQL from the client's input](#s10-7)
- [Chapter 11 — `@PageSelect` in depth](#ch11)
- [Chapter 12 — Pagination & sorting (`IPage`)](#ch12)
- [Chapter 13 — The functions: `findAllByPage`, `findOne`, `findOptions`](#ch13)
- [Chapter 14 — `customQuery`: server-authoritative conditions](#ch14)
- [Chapter 15 — The response envelope & Swagger](#ch15)

**[Part IV — The cookbook](#part-iv)**
- [Chapter 16 — Recipes](#ch16)
  - [16.1 — A search box over several columns](#r16-1)
  - [16.2 — A strict filter (id / FK / enum / boolean)](#r16-2)
  - [16.3 — Multi-value / enum multi-select](#r16-3)
  - [16.4 — A date (or numeric) range](#r16-4)
  - [16.5 — Lower / upper bound only](#r16-5)
  - [16.6 — Presence / absence](#r16-6)
  - [16.7 — Filter by a related table's column](#r16-7)
  - [16.8 — Embed a relation on demand](#r16-8)
  - [16.9 — "Today" / computed filters](#r16-9)
  - [16.10 — Computed filter from the request value](#r16-10)
  - [16.11 — Strict filter *and* OR-groupable search on one column](#r16-11)
  - [16.12 — Sparse fieldset (return only some columns)](#r16-12)
  - [16.13 — Fetch one by id **or** business key](#r16-13)
  - [16.14 — Force tenancy / visibility](#r16-14)
  - [16.15 — "Give me everything" (bounded export)](#r16-15)
  - [16.16 — Default sort per endpoint](#r16-16)

**[Part V — Customization & extension](#part-v)**
- [Chapter 17 — Customizing in the controller](#ch17)
- [Chapter 18 — Customizing in the service](#ch18)
  - [18.1 — Wrap `findAllByPage` and post-process rows](#r18-1)
  - [18.2 — Override `getAll`, branch on a virtual field, then `super.getAll()`](#r18-2)
  - [18.3 — Rewrite the DTO before delegating](#r18-3)
  - [18.4 — `findOptions` → run against a *different* entity](#r18-4)
  - [18.5 — `findOptions` → mutate the options, then run](#r18-5)
  - [18.6 — `findOptions` → spread `where` into a bulk `update`](#r18-6)
  - [18.7 — Cap the page size for an "all rows" variant](#r18-7)
  - [18.8 — `findOne` variants: extra where, alternate keys](#r18-8)
  - [18.9 — Merge the paged result with data from elsewhere](#r18-9)
  - [18.10 — Plain service, no `CommonService`](#r18-10)
- [Chapter 19 — The repository / manager level](#ch19)
- [Chapter 20 — Composing with QueryBuilder](#ch20)

**[Part VI — Field guide to this codebase](#part-vi)**
- [Chapter 21 — Usage statistics](#ch21)
- [Chapter 22 — Catalogue of `@PageSearch` combinations](#ch22)
- [Chapter 23 — Catalogue of function-call patterns](#ch23)
- [Chapter 24 — Catalogue of controller patterns](#ch24)

**[Part VII — Under the hood](#part-vii)**
- [Chapter 25 — How the `where` is assembled](#ch25)
- [Chapter 26 — The AND / OR merge model, explained](#ch26)
- [Chapter 27 — Operation → TypeORM operator reference](#ch27)

**[Appendices](#appendices)**
- [Appendix A — Gotchas & limitations](#appx-a)
- [Appendix B — Troubleshooting table](#appx-b)
- [Appendix C — Import / export map](#appx-c)
- [Appendix D — Full type definitions](#appx-d)
- [Appendix E — Glossary](#appx-e)
- [Appendix F — Version & accuracy notes](#appx-f)

---
---

<a id="part-i"></a>

# Part I — Why this package exists

<a id="ch1"></a>

## Chapter 1. The problem with list endpoints

Almost every resource in a CRUD application needs a "list" endpoint, and a list
endpoint is never *just* a list. Over its life it accretes requirements:

- **Optional filters** — `?class_id=7`, `?status=active`, often ten or twenty of them,
  any combination, any subset present.
- **A search box** — one text term matched, with `LIKE`, across several columns at once
  (`first_name`, `last_name`, `full_name`, `email`…), where **any** match should count.
- **Filtering by a related table's column** — "students whose *class name* contains
  'science'", which needs a join.
- **Optional relation embedding** — sometimes the caller wants `student.class` and
  `student.section` inlined; usually it doesn't, and joining them always is wasteful.
- **Ranges** — `created_at BETWEEN a AND b`, `score >= 40`.
- **Set membership** — `state IN ('Current','Passout')`.
- **"Computed" filters** — "has a birthday today", "checked in this month" — small SQL
  expressions, not column comparisons.
- **Pagination** — offset/limit, with a total count for the UI.
- **Sorting** — by one or several columns, ascending or descending, sometimes by a
  joined column.

Hand-written, this produces the same shape in every service: a long ladder of
`if (query.x) qb.andWhere(...)`, ad-hoc `skip`/`take` arithmetic, a hand-rolled
`_sort` parser (often a SQL-injection hole), and a response envelope invented afresh
each time. The cost compounds:

| Symptom | Consequence |
|---|---|
| Filter logic lives in the service body | adding a filter means editing, re-reading, and re-testing the service |
| Each endpoint invents its own param names & semantics | the front-end needs a bespoke data provider per resource |
| `LIKE` vs `=` vs `IN` decided inline, case by case | inconsistent, and easy to get wrong (e.g. `LIKE` on an id) |
| No schema for "what is queryable" | no validation, no Swagger, no single place to look |
| Pagination / sort re-implemented | subtle drift (is `_end` a size or an index? is sort injectable?) |
| Query assembly entangled with execution | can't unit-test "did we build the right query?" without a database |

<a id="ch2"></a>

## Chapter 2. What this package does

It moves the **description of the query surface** out of the service body and onto the
DTO, next to the validation and Swagger metadata where it belongs:

```ts
export class StudentSearchDto {
  @IsOptional() @Type(() => Number)
  @PageSearch({ operation: 'eq', operator: 'and' })     // strict filter
  class_id: number;

  @IsOptional()
  @PageSearch()                                         // LIKE %term%, OR-grouped
  full_name: string;

  @IsOptional()
  @PageSearch({ column: 'class.name', is_nested: true }) // filter via a relation
  class_name: string;

  @IsOptional()
  @PageSearch({ is_relational: true })                  // embed the relation on demand
  class: boolean;
}
```

At request time, one function call:

1. reads the decorator metadata for every property the client actually sent,
2. builds a TypeORM `FindManyOptions` — `where`, `order`, `relations`, `skip`, `take`,
   `select`,
3. runs `repo.findAndCount(...)`,
4. returns a uniform `Page<T>` envelope `{ elements, totalElements, pageable }`.

The controller shrinks to a typed pass-through; the service shrinks to one line. The
crucial property: **the query surface is now data, not control flow.** Adding a filter
is adding a decorated line — nothing else changes.

Just as importantly, the engine's output is a **plain TypeORM `FindManyOptions`**.
There is a function (`findOptions()`) that stops after step 2 and hands you that object,
so you are never trapped: the moment a query outgrows the model, you take the generated
`where` and run it through a `QueryBuilder` yourself.

<a id="ch3"></a>

## Chapter 3. Advantages at a glance

1. **Dramatically less code.** A fully filterable, searchable, paginated,
   relation-aware endpoint is ~4 small files, most of them declarative. The service
   method is one line.

2. **Fast iteration.** New filter → one decorated property on the DTO. The service and
   controller are never touched. New sort column → nothing to do; it already works.

3. **One consistent contract across the whole API.** Every list endpoint takes the same
   pagination params (`_start`, `_end`, `_sort`, `_order` — the react-admin /
   `ra-data-simple-rest` convention) and returns the same `Page<T>` envelope. A generic
   front-end data provider works for all of them; the admin UIs in this monorepo
   (`skool-mui` and friends) rely on exactly this.

4. **Separation of concerns.** "What is queryable, and how" sits on the DTO beside
   `@IsOptional()` and `@ApiProperty()`. Service code goes back to being business logic.

5. **No lock-in.** The engine emits a standard `FindManyOptions`. `findOptions()`
   exposes it; you can mutate it, feed its `where` to a `QueryBuilder`, run it against a
   *different* entity via `repo.manager`, or spread it into `repo.update()`. Adopt it
   per-endpoint; abandon it per-endpoint.

6. **The hard parts are handled.** Relation filtering, **nested** relation paths
   (`subject.books`, `vehicle.routeLocation.route`), `IN` / `BETWEEN` / `IS NULL` /
   `NOT IN`, a `raw` SQL escape hatch (static or a function of the input), multi-column
   sort, and **nested** sort (`_sort=class.name`).

7. **Safer by construction.** `ValidationPipe({ whitelist: true })` drops any query
   param that isn't a declared, decorated field, so unknown input can't reach the
   builder. Tenancy / visibility rules go in `customQuery` **in code**, where the client
   cannot override them.

8. **Swagger-native.** `@PageSearch` and `@ApiProperty` coexist on the same property;
   subclass `Page<T>` once for a typed, documented response shape.

9. **Testable.** `findOptions()` is a pure function — assert on the `FindManyOptions` it
   returns without touching a database.

10. **Small and readable.** It's a thin layer: a handful of files in
    [`../nestjs-search-page/project/src`](../nestjs-search-page/project/src). You can
    read the entire implementation in fifteen minutes (Part VII summarises it).

<a id="ch4"></a>

## Chapter 4. Before & after — a real comparison

### Before — a hand-rolled list endpoint

```ts
@Get()
async findAll(@Query() q: any) {
  const qb = this.repo.createQueryBuilder('s');

  if (q.class_id)   qb.andWhere('s.class_id = :class_id',   { class_id: q.class_id });
  if (q.section_id) qb.andWhere('s.section_id = :section_id',{ section_id: q.section_id });
  if (q.state) {
    const state = Array.isArray(q.state) ? q.state : String(q.state).split(',');
    qb.andWhere('s.state IN (:...state)', { state });
  }
  if (q.first_name) qb.andWhere('s.first_name LIKE :fn', { fn: `%${q.first_name}%` });
  if (q.last_name)  qb.andWhere('s.last_name  LIKE :ln', { ln: `%${q.last_name}%` });
  if (q.class_name) {
    qb.leftJoin('s.class', 'c').andWhere('c.name LIKE :cn', { cn: `%${q.class_name}%` });
  }
  if (q.class === 'true') qb.leftJoinAndSelect('s.class', 'class');

  const start = Number(q._start) || 0;
  const end   = Number(q._end)   || 20;
  qb.skip(start).take(end - start);

  if (q._sort) qb.orderBy(`s.${q._sort}`, (q._order || 'DESC').toUpperCase()); // ⚠ injectable
  else         qb.orderBy('s.id', 'DESC');

  const [elements, totalElements] = await qb.getManyAndCount();
  return { elements, totalElements };
}
```

What's wrong with it: no validation or Swagger; `_sort` is a SQL-injection vector;
`first_name`/`last_name` are AND-ed when a search box wants OR; the param contract is
implicit and will drift from the next resource's; **every new filter is another `if`**;
and "build the query" can't be tested without a live DB.

### After — the same endpoint with this package

```ts
// dto/search.dto.ts
export class StudentSearchDto {
  @IsOptional() @Type(() => Number) @PageSearch({ operation: 'eq', operator: 'and' })
  class_id: number;

  @IsOptional() @PageSearch({ operation: 'eq', operator: 'and' })
  section_id: string;

  @IsOptional() @PageSearch({ operation: 'in', operator: 'and' })
  state: StudentStateEnum[];

  @IsOptional() @PageSearch() first_name: string;      // OR + LIKE  (search box)
  @IsOptional() @PageSearch() last_name: string;

  @IsOptional() @PageSearch({ column: 'class.name', is_nested: true })
  class_name: string;

  @IsOptional() @PageSearch({ is_relational: true })
  class: boolean;
}
```
```ts
// service.ts
getAll(page: PageDto, search: StudentSearchDto): Promise<Page<Student>> {
  return findAllByPage<Student>({ repo: this.repo, page, queryDto: search });
}
```
```ts
// controller.ts
@Get()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
getAll(@Query() search: StudentSearchDto, @Query() page: PageDto) {
  return this.service.getAll(page, search);
}
```

Six months later, "let us also search by phone" is **one line** in the DTO
(`@IsOptional() @PageSearch() phone: string;`). The service and controller do not
change. The front-end already knows how to send it. Swagger already documents it.

<a id="ch5"></a>

## Chapter 5. When to use it, and when to drop to raw TypeORM

**Use it for** the common case: a resource list with optional filters, a text search,
optional relation embedding, pagination, and sorting — i.e. 90% of `GET /things`
endpoints.

**Drop to `QueryBuilder`** (optionally *starting* from `findOptions().where`) when the
query needs:

- aggregation — `GROUP BY`, `COUNT(DISTINCT …)`, `SUM`, window functions;
- `INNER JOIN` on a **non-relation** join condition, or a join to a bare table;
- computed/derived columns in the `SELECT` list;
- `HAVING`, `UNION`, CTEs, or database-specific SQL;
- correlated sub-queries.

This isn't a compromise — it's the intended design. In this codebase the reporting
modules (`*/report/repositories/*`) are pure QueryBuilder, and several list services
call `findOptions()` for the `where`/paging and then run it through a `QueryBuilder`
that adds the joins the model can't express (Chapter 20). The package handles the
boilerplate; you keep full SQL power for the 10%.

---
---

<a id="part-ii"></a>

# Part II — Getting started

<a id="ch6"></a>

## Chapter 6. Installation & prerequisites

```bash
npm install @sksharma72000/nestjs-search-page
```

### Peer stack

The package assumes a standard NestJS + TypeORM project and leans on these already
being present:

| Package | Used for |
|---|---|
| `typeorm` (+ `mysql2`) | building & executing `FindManyOptions` |
| `@nestjs/typeorm` | `@InjectRepository`, `Repository<T>` |
| `class-transformer` | `@Type()` coercion of query-string values |
| `class-validator` | `@IsOptional()` &c. and the `ValidationPipe` |
| `reflect-metadata` | the decorators call `Reflect.defineMetadata` / `getMetadata`; NestJS already imports this once at bootstrap |

### `tsconfig.json`

NestJS's default already satisfies this:

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false
  }
}
```

### The mandatory `ValidationPipe` configuration

Every controller method that binds a search/page DTO from `@Query()` must use:

```ts
new ValidationPipe({ whitelist: true, transform: true })
```

- **`whitelist: true`** — strips every query param that is not a decorated DTO
  property. Unknown input never reaches the builder. (This also means you cannot
  "pass through" an arbitrary filter that has no DTO field — by design.)
- **`transform: true`** together with `@Type(() => Number | Boolean)` — coerces `"7"`
  to `7` and `"true"` to `true`, so `eq` on a numeric column compares numbers, and
  boolean toggles evaluate correctly.

### Optional environment variables

Read at runtime by the package:

| Variable | Default | Effect |
|---|---|---|
| `DEFAULT_PAGE_SIZE` | `10` | `take` used when `_end` is missing or invalid |
| `DEFAULT_SORT_COLUMN` | `id` | sort column used when `_sort` is empty |

<a id="ch7"></a>

## Chapter 7. Your first endpoint, in four files

This is the canonical setup. An AI agent can reproduce it verbatim in any NestJS +
TypeORM project.

### File 1 — a shared `PageDto` (once per project)

```ts
// src/common/dto/page.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { SortDirection } from '@sksharma72000/nestjs-search-page/constants';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class PageDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Type(() => Number)
  _start: number;                     // row offset  → skip

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Type(() => Number)
  _end: number = 20;                  // ABSOLUTE end row → take = _end − _start

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  _sort: string;                      // column(s); comma = multi, dot = nested

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  _order: SortDirection;              // 'ASC' | 'DESC' (comma-separated, aligned with _sort)
}
```

### File 2 — the resource's search DTO

```ts
// things/dto/search.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PageSearch } from '@sksharma72000/nestjs-search-page';

export class ThingSearchDto {
  @ApiProperty({ required: false })
  @IsOptional() @Type(() => Number)
  @PageSearch({ operation: 'eq', operator: 'and' })   // strict filter
  category_id: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @PageSearch()                                        // LIKE %v%, OR — search box
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @PageSearch({ column: 'category.title', is_nested: true })   // filter via relation
  category_title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @PageSearch({ is_relational: true })                 // ?category=true → embed relation
  category: boolean;
}
```

### File 3 — the service

```ts
// things/service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findAllByPage, findOne, Page } from '@sksharma72000/nestjs-search-page';
import { Thing } from './thing.entity';
import { PageDto } from 'src/common/dto/page.dto';
import { ThingSearchDto } from './dto/search.dto';

@Injectable()
export class ThingService {
  constructor(@InjectRepository(Thing) private readonly repo: Repository<Thing>) {}

  getAll(page: PageDto, search: ThingSearchDto): Promise<Page<Thing>> {
    return findAllByPage<Thing>({ repo: this.repo, page, queryDto: search });
  }

  getById(id: number, search: ThingSearchDto): Promise<Thing> {
    return findOne<Thing>({ id, repo: this.repo, queryDto: search });
  }
}
```

### File 4 — the controller

```ts
// things/controller.ts
import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { PageDto } from 'src/common/dto/page.dto';
import { ThingSearchDto } from './dto/search.dto';
import { ThingService } from './service';

@Controller('things')
export class ThingController {
  constructor(private readonly service: ThingService) {}

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  getAll(@Query() search: ThingSearchDto, @Query() page: PageDto) {
    return this.service.getAll(page, search);
  }

  @Get(':id')
  getOne(@Param('id') id: number, @Query() search: ThingSearchDto) {
    return this.service.getById(id, search);
  }
}
```

Register `TypeOrmModule.forFeature([Thing])` and the controller/service in the module,
and you have:

```
GET /things?name=widget&category_id=3&category=true&_start=0&_end=20&_sort=id&_order=DESC
GET /things/42?category=true
```

### The three non-negotiables

1. `new ValidationPipe({ whitelist: true, transform: true })` on the `@Query()`.
2. `@Type(() => Number)` (or a boolean transform) on every non-string field.
3. Exact-match filters carry `{ operation: 'eq', operator: 'and' }` — the **default is
   `LIKE %v%` + `OR`**.

<a id="ch8"></a>

## Chapter 8. The request lifecycle

```
HTTP  GET /things?category_id=3&name=ram&category=true&_start=0&_end=20&_sort=name&_order=ASC
  │
  ▼   NestJS ValidationPipe({ whitelist:true, transform:true })
  │     @Query() search : ThingSearchDto   ← unknown keys dropped, types coerced
  │     @Query() page   : PageDto
  ▼   service: findAllByPage({ repo, page, queryDto: search, selectDto?, customQuery? })
  │
  │   ┌─ findOptions()  — pure, no DB ────────────────────────────────────────┐
  │   │  • for each key in queryDto: read @PageSearch metadata                │
  │   │      – is_relational?  → push to relations[]   (no condition)         │
  │   │      – operation 'raw' → evaluate value (string or fn(reqValue))      │
  │   │      – else            → value = reqValue                             │
  │   │      – build a TypeORM operator (Like/Equal/In/Between/Raw/…)         │
  │   │      – drop it in the 'and' or 'or' bucket                            │
  │   │  • read @PageSelect metadata (selectDto and/or queryDto) → select {}  │
  │   │  • merge customQuery[] the same way                                   │
  │   │  • page._start/_end   → skip / take                                   │
  │   │  • page._sort/_order  → order {}  (supports a,b and a.b)              │
  │   │  • combine buckets → where  (array ⇒ OR; AND object merged into each) │
  │   │  RETURNS FindManyOptions { where, order, relations, select, skip, take }│
  │   └──────────────────────────────────────────────────────────────────────┘
  ▼
  repo.findAndCount(options)   →   [ rows, total ]
  │
  ▼
  Page<T> { elements: rows, totalElements: total, pageable: page }
```

The single idea to hold onto: **`findOptions()` is the whole engine.**
`findAllByPage()` = `findOptions()` + `repo.findAndCount()` + wrap.
`findOne()` = `findOptions()` (no paging) + `repo.findOne()`.
Everything in Part V is "call `findOptions()` and take over from there".

---
---

<a id="part-iii"></a>

# Part III — The core model

<a id="ch9"></a>

## Chapter 9. The three DTOs

| DTO | Decorator | Answers the question | Passed to the functions as |
|---|---|---|---|
| **Search DTO** | `@PageSearch()` | *Which columns are filterable, how do they compare, and which relations may be embedded?* | `queryDto` |
| **Select DTO** | `@PageSelect()` | *Which columns / relations should the response contain?* (sparse fieldsets) | `selectDto` |
| **Page DTO** | *(plain `IPage` shape)* | *Which slice, in what order?* (`_start`, `_end`, `_sort`, `_order`) | `page` |

A typical endpoint binds **two** `@Query()` arguments: the search DTO and the page DTO.
The select DTO is optional and is often either folded into the search DTO (mix
`@PageSelect` properties in) or delivered through a small wrapper DTO that accepts
`?select={…}&filter={…}` as JSON.

All three are plain classes populated by Nest's `@Query()` binding — nothing about them
is special beyond the decorators and the `IPage` property names.

<a id="ch10"></a>

## Chapter 10. `@PageSearch` in depth

```ts
import { PageSearch } from '@sksharma72000/nestjs-search-page';

@PageSearch(options?: IPageSearch)      // property decorator
```

### Options and their defaults

```ts
interface IPageSearch {
  column?:        string;    // default: the property name
  is_relational?: boolean;   // default: null  (falsy)
  is_nested?:     boolean;   // default: false (auto-true when `column` contains '.')
  operation?:     Operation; // default: 'like'
  operator?:      Operator;  // default: 'or'
  value?: string | number | boolean | null
        | Array<string | number | boolean>
        | Function;          // only meaningful with operation: 'raw'
}
```

The decorator stores, as reflect-metadata under the key `SK_PAGE_SEARCH`:
`{ column: <propertyKey>, is_relational: null, is_nested: false, operation: 'like', operator: 'or', value: null, ...yourOptions }`.

### `column` — which database column

Defaults to the property name, so the idiomatic style is: **name the property after the
column and omit `column`.** Set it explicitly when:

- the property name differs from the column (`class_name` filtering `class.name`);
- you want two properties to target the **same** column with different behaviour
  (a strict `eq` filter *and* an OR-groupable `like` search — see Chapter 26);
- the column lives on a relation (`column: 'post.title'`).

### `is_nested` — filter by a related table's column

When `column` contains a dot, the condition is built as a nested object and the dot
**auto-enables** `is_nested` (you may still write it for clarity):

```ts
@PageSearch({ column: 'post.title' })
post_title: string;
// → where: { post: { title: Like('%…%') } }
```

TypeORM will **join `post` to filter on it**, but will **not include `post` in the
result** unless the relation is also loaded (via `is_relational`, a `@PageSelect`,
`customQuery`, or your own `relations`). Deeper paths work:
`column: 'vehicle.routeLocation.route'` → `{ vehicle: { routeLocation: { route: … } } }`.

### `is_relational` — embed a relation in the response

```ts
@PageSearch({ is_relational: true })
class: boolean;                          // ?class=true  → relations: ['class']

@PageSearch({ column: 'subject.books', is_relational: true })
books: boolean;                         // ?books=true  → relations: ['subject.books']
```

- Adds `column` to `relations[]`; **adds no `where` condition.**
- It keys off the **decorator option**, not the request value. If the property is
  present in the query object at all, the relation is joined — `?class=false` still
  loads `class`. With `whitelist: true` the key only appears when the client sends it,
  so in practice the rule is "send the key to opt in".
- `is_nested: true` alongside it only signals that the relation *path* has dots.

### `operation` — the comparison

Full mapping in Chapter 27. The essentials:

| `operation` | Produces | Use for |
|---|---|---|
| `'like'` *(default)* | `Like('%value%')` | free-text search boxes |
| `'eq'` | raw equality | id, FK, enum, boolean, exact string |
| `'in'` | `In(value)` — array **or** `"a,b,c"` string; scalar wrapped to `[value]` | multi-select |
| `'between'` | `Between(value[0], value[1])` — needs a 2+ element array, else **silently skipped** | ranges |
| `'gteq'` / `'lteq'` / `'gt'` / `'lt'` | `MoreThanOrEqual` / … | bounds |
| `'isNull'` / `'isNotNull'` | `IS NULL` / `IS NOT NULL` — request value ignored | presence toggles |
| `'neq'` / `'notIn'` / `'notLike'` / `'notBetween'` | negations | exclusions |
| `'raw'` | `Raw(() => value)` | arbitrary SQL — see below |

### `operation: 'raw'` — the SQL escape hatch

`raw` splices a SQL fragment straight into the `WHERE` clause (via TypeORM's `Raw()`).
The fragment comes from `value`, which may be a **string** or a **function** — the two
forms are covered here, then §10.7 details the function form.

```ts
// (a) STATIC fragment — the property is just an on/off toggle
@PageSearch({
  column: 'dob_en', operation: 'raw', operator: 'and',
  value: `MONTH(dob_en) = MONTH(CURDATE()) AND DAY(dob_en) = DAY(CURDATE())`,
})
birthday: boolean;                     // ?birthday=true → "has a birthday today"

// (b) FUNCTION — value: (clientValue) => sqlString
@PageSearch({
  column: 'check_time', operation: 'raw', operator: 'and',
  value: (date) => `DATE(check_time) = '${date}'`,
})
attendance_date: string;              // ?attendance_date=2026-08-30
```

Rules common to both forms:

- The condition is applied whenever the **key is present** in the query object; for the
  static form the request value itself is **not compared** (`?birthday=false` still
  applies the fragment).
- ⚠️ **You are writing SQL by hand — you own injection safety.** Only interpolate values
  you have validated. In this codebase `raw` is used exclusively for date arithmetic
  against `CURDATE()` and for tightly-controlled inputs.
- Set `column` so the fragment nests sensibly. With `is_nested` and a dotted `column`,
  the `Raw()` is wrapped as `{ rel: { col: Raw(...) } }`, which makes TypeORM evaluate
  the fragment against the **joined relation's alias** — that is how `current_schedule`
  in [`academic/timeline`](src/modules/academic/timeline/dto/search.dto.ts) can write
  `TIME(NOW()) BETWEEN period.start_time AND period.end_time`.

<a id="s10-7"></a>

### §10.7 Function `value` — dynamic raw SQL from the client's input

*(Verified against the built engine —
[`../nestjs-search-page/publish/models/entity.js`](../nestjs-search-page/publish/models/entity.js),
`_getMetaQuery` → `_buildWhere` → `_switchCondition`.)*

When `value` is a **function**, the engine does this, in order:

```js
// inside the queryDto loop of _getMetaQuery()
if (pageSearch.operation == "raw") {
  if (typeof pageSearch.value === "function") {
    pageSearch.value = pageSearch.value(whereQuery[key]);   // ① call with the client's value
  }
} else {
  pageSearch.value = whereQuery[key];                        // (non-raw: function is discarded)
}
if (pageSearch.value == undefined || pageSearch.value.toString() == "") {
  continue;                                                  // ② empty return ⇒ NO condition
}
_buildWhere(pageSearch, whereConditions);                    // ③ Raw(() => <returned string>)
```

**① The argument is the client-sent value for that property**, i.e. `whereQuery[key]`,
*after* `ValidationPipe` / `@Type()` transformation:

| Property decoration | The function receives |
|---|---|
| plain `string` property | the raw string (`"2026-08-30"`) |
| `@Type(() => Number)` | a `number` |
| `@Type(() => Boolean)` | a `boolean` |
| client omitted the param (`whitelist:true`, no default) | *the function is never called* — the key isn't in the object |
| client omitted it but the DTO sets a default | the default value |

**② The return value is the whole filter.** Whatever string the function returns
becomes the SQL fragment (`Raw(() => returnedString)`). And crucially — **returning
`undefined`, `null`, or `''` cleanly disables the condition for that request** (the
post-evaluation empty-check does `continue`). This is the *intended* mechanism for
"only apply this filter when the input is usable"; it is **not** an error path. Example
from [`academic/calendar/dto/search.dto.ts`](src/modules/academic/calendar/dto/search.dto.ts):

```ts
@PageSearch({
  column: 'start', operation: 'raw', operator: 'and',
  value: (date) => {
    date = date ? new Date(date).toISOString() : null;
    if (date) {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      return `(YEAR(start) = ${year} AND MONTH(start) = ${month}) `
           + `OR (YEAR(end) = ${year} AND MONTH(end) = ${month})`;
    }
    // implicit `return undefined` ⇒ the "date" filter is simply not applied
  },
})
date: string;
```

Straightforward interpolation example from
[`employee/attendance/records/dto/search.dto.ts`](src/modules/employee/attendance/records/dto/search.dto.ts):

```ts
@PageSearch({
  column: 'check_time', operation: 'raw', operator: 'and',
  value: (date) => `DATE(check_time) = '${date}'`,
})
attendance_date: string;                // ?attendance_date=2026-08-30
```

**Return-value truth table:**

| Function returns | Result |
|---|---|
| a non-empty string | `WHERE … AND (<that string>)` — spliced verbatim |
| `undefined` / `null` / `''` | condition skipped (no effect on the query) |
| a number `0` / `false` | passed through as `Raw(() => 0/false)` — almost certainly not what you want; always return a string or nothing |

**Constraints:**

- **Function `value` works only with `operation: 'raw'`.** For any other operation the
  engine executes `pageSearch.value = whereQuery[key]`, throwing your function away.
- **Function `value` works only for `@PageSearch` metadata on the `queryDto`.** In a
  `customQuery` entry the function is **not** evaluated — `customQuery` items go straight
  to `_buildWhere`, so a function reaches `Raw(() => fn)` and breaks. In `customQuery`,
  use a **string** `value` for `raw`.
- You are responsible for escaping. Prefer building the fragment from values you have
  already validated / coerced (`Number(v)`, an enum check, a date parse) rather than
  from the raw string.

**When to use the function form vs. the static form:**

| Need | Form |
|---|---|
| a fixed predicate toggled by a flag (`?today=true`, `?birthday=true`) | **static** string |
| a predicate whose text depends on what the client sent (`?month=2026-08`, `?attendance_date=…`) | **function** |
| the predicate should vanish when the input is missing/blank | **function** returning `undefined` in that case |

### `operator` — how conditions combine

`'and'` or `'or'`; **default `'or'`**. This is the single most important behaviour to
understand, and it has its own chapter — see **Chapter 26**. In brief:

- **OR** conditions each become their own object in a `where` **array** ⇒ TypeORM ORs
  them.
- **AND** conditions are deep-merged into **one** object, and that object is merged into
  **every** OR branch.

So OR fields `a, b` + AND fields `x, y` produce
`(a AND x AND y) OR (b AND x AND y)`. Practical rule: **filters** →
`operator: 'and'`; **search-box fields** → leave the default `'or'`.

### `value`

For every operation except `raw`, the decorator's `value` is ignored — the value comes
from the request. Request values of `undefined`, `null`, or `''` produce **no
condition**. `0` and `false` **do** produce a condition.

<a id="ch11"></a>

## Chapter 11. `@PageSelect` in depth

```ts
import { PageSelect } from '@sksharma72000/nestjs-search-page';

@PageSelect(options?: IPageSelect)      // property decorator
```

```ts
interface IPageSelect {
  select: string | object;             // default: the property name
  type?: 'default' | 'relational';     // default: 'default'
}
```

Stored under reflect-metadata key `SK_IS_SELECT`. A `@PageSelect` property is
**activated only when its request value is boolean `true` or the string `"true"`** — so
give it `@Type(() => Boolean)` / a transform, or send `?fn=true`.

### `type: 'default'` — pick a column

```ts
@PageSelect({ select: 'first_name' }) fn: boolean;   // ?fn=true → select: { first_name: true }
```

A dotted `select` on a `default` builds a nested select **and** pushes the parent onto
`relations`: `select: 'profile.name'` → `select: { profile: { name: true } }` +
`relations: ['profile']`.

### `type: 'relational'` — load a whole relation

```ts
@PageSelect({ select: 'class',         type: 'relational' }) cls: boolean;  // relations: ['class']
@PageSelect({ select: 'father.father', type: 'relational' }) fth: boolean;  // relations: ['father.father']
```

### `id` is always included

The moment **any** selection is active, the builder force-adds `id: true`. If no
selection is active, `select` is left unset and all columns are returned.

### Where the select DTO is bound

**Use a dedicated DTO passed as `selectDto`.** This repo's
[`StudentSelectDto`](src/common/dto/student/select.dto.ts) is the canonical example —
short aliases (`fn`, `ln`, `cls`, …) mapped to real columns/relations. It is delivered
through a wrapper, [`StudentQueryDto`](src/common/dto/student/query.dto.ts), that
accepts `?select={…}&filter={…}` as JSON strings, `@Transform`s them into nested
objects, and the controller calls `service.getAll(page, query.filter, query.select)`.
The `selectDto` loop accepts `true` **or** the string `"true"` as the activator.

⚠️ **Mixing `@PageSelect` into the search DTO does not work in v3.2.4.** The engine's
`queryDto` loop opens each key with
`Object.assign({}, Reflect.getMetadata(SK_PAGE_SEARCH, dto, key))`, which is always a
truthy `{}`, so the branch that would check `SK_IS_SELECT` on a `queryDto` key is
unreachable. Keep selection in its own `selectDto`.

<a id="ch12"></a>

## Chapter 12. Pagination & sorting (`IPage`)

```ts
interface IPage {
  _start: number;         // row offset
  _end:   number;         // ABSOLUTE end row (not a page size)
  _sort:  string;         // column name(s)
  _order: SortDirection;  // 'ASC' | 'DESC'
}
```

These names are the **react-admin / `ra-data-simple-rest`** convention; the admin
front-ends in this monorepo send them automatically.

| Param | → | Rules |
|---|---|---|
| `_start` | `skip` | `Number(_start)`; negative or non-finite → `0`; default `0` |
| `_end` | `take = _end − _start` | default `_start + DEFAULT_PAGE_SIZE` (`10`); non-finite or `< _start` → same default. **`_start=20&_end=40` ⇒ skip 20, take 20.** |
| `_sort` | `order` keys | comma-separated for multiple columns; a dot builds nested order (`class.name` → `{ class: { name: … } }`); empty → `DEFAULT_SORT_COLUMN` or `id` |
| `_order` | `order` values | comma-separated, **positionally aligned** with `_sort`; empty → `DESC` |

```
?_sort=full_name&_order=ASC
?_sort=class.name&_order=ASC              → order: { class: { name: 'ASC' } }
?_sort=first_name,id&_order=ASC,DESC      → order: { first_name: 'ASC', id: 'DESC' }
```

If the `page` argument is **omitted entirely** (as `findOne` does, and as several
`findOptions` callers do), there is **no** `skip` / `take` / `order` — all matching
rows, unordered.

<a id="ch13"></a>

## Chapter 13. The functions — `findAllByPage`, `findOne`, `findOptions`

All three are plain functions (not injectable), imported from the package root.

### `findAllByPage<T>(args): Promise<Page<T>>`

Runs the query **with pagination**, returns a `Page<T>`.

```ts
interface IFindAllByPage {
  repo: Repository<any>;        // required
  page: IPage;                  // required — your PageDto
  queryDto?:   object;          // your @PageSearch DTO
  selectDto?:  object;          // your @PageSelect DTO
  customQuery?: IPageSearch[];  // server-side extra conditions (Chapter 14)
}
```
```ts
return findAllByPage<Comment>({
  repo: this.commentRepo,
  page: pageDto,
  queryDto: commentSearchDto,
  customQuery: [{ column: 'status', value: 'active', operation: 'eq', operator: 'and' }],
});
```

Internally: `repo.findAndCount(findOptions(...))` → `{ elements, totalElements, pageable: page }`.

### `findOne<T>(args): Promise<T | null>`

Single row, **no pagination / order**. At least one of
`id | queryDto | selectDto | customQuery` is required, otherwise it throws
`Error('One of (id|queryDto|selectDto|customQuery) must be defined')`.

```ts
interface IFindOne {
  id?: string | number;        // adds { column:'id', value:id, operation:'eq', operator:'and' }
  repo: Repository<any>;       // required
  queryDto?:   object;
  selectDto?:  object;
  customQuery?: IPageSearch[];
}
```
```ts
return findOne<Comment>({ id, repo: this.commentRepo, queryDto: commentSearchDto });
```

⚠️ `findOne` **mutates the `customQuery` array you pass** (it `push`es the `id`
condition). Always pass a fresh array literal — never a shared module-level constant, or
`id` conditions accumulate across calls.

Look up by id **or** an alternate key — skip the `id` arg, use `customQuery` with
`operator: 'or'` (real example — [`voucher/service.ts`](src/modules/account/voucher/service.ts)):

```ts
findOne<AccountVoucher>({
  repo: this.repo,
  queryDto: searchDto,
  customQuery: [
    { column: 'id',         value: id, operation: 'eq', operator: 'or' },
    { column: 'voucher_no', value: id, operation: 'eq', operator: 'or' },
  ],
});
```

### `findOptions<T>(args): FindManyOptions<T>`

The engine, exposed. **Builds and returns** the options; does **not** touch the
database. At least one of `page | queryDto | selectDto | customQuery` required,
otherwise `Error('One of (page|queryDto|selectDto|customQuery) must be defined')`.

```ts
interface IFindOptionByPage {
  page?: IPage;
  queryDto?:   object;
  selectDto?:  object;
  customQuery?: IPageSearch[];
}
```

Returns:

```ts
{
  where:     FindOptionsWhere<T> | FindOptionsWhere<T>[],  // array of objects when OR present
  order:     FindOptionsOrder<T> | undefined,              // undefined when no `page`
  relations: string[],                                     // e.g. ['class', 'subject.books']
  select:    object | undefined,
  skip:      number | undefined,
  take:      number | undefined,
}
```

Reach for it whenever you must **run the query yourself** — a different entity,
`withDeleted`, feeding `where` into a `QueryBuilder`, spreading into `repo.update()`,
capping the page size, post-processing rows. All of Part V builds on this.

### Which one do I call?

| Situation | Function |
|---|---|
| standard paginated list endpoint | `findAllByPage` |
| fetch one row by id, honouring the search DTO | `findOne` |
| fetch one row by id **or** a business key | `findOne` with `customQuery` (no `id` arg) |
| need the options but will run/modify the query myself | `findOptions` |
| query a different entity than my injected repo | `findOptions` + `repo.manager.find(Other, opts)` |
| need real joins / aggregation | `findOptions().where` + `QueryBuilder` |

<a id="ch14"></a>

## Chapter 14. `customQuery` — server-authoritative conditions

`customQuery: IPageSearch[]` is a list of conditions **added in code**, not from the
URL. Each entry has the same shape as a `@PageSearch` option object, but **you** supply
`value`. It is how tenancy / visibility / "only active" / "only my class" rules are
enforced where the client cannot touch them.

```ts
customQuery: [
  { column: 'status',    value: StatusEnum.Active, operation: 'eq',     operator: 'and' },
  { column: 'class_id',  value: allowedClassIds,   operation: 'in',     operator: 'and' },
  { column: 'parent_id', value: null,              operation: 'isNull', operator: 'and' },
]
```

- Same AND/OR merge semantics as decorator conditions (Chapter 26). Almost always
  `operator: 'and'`.
- A `customQuery` entry that has a `select` key is routed to the select builder instead
  of the where builder (rare — prefer a `selectDto`).
- Common pattern — derive an id list from another table, pass it as an `in` condition,
  and remove the "virtual" field that triggered it:

```ts
const classIds = (await mgr.findBy(AcademicTimeline, { staff_id })).map(t => t.class_id);
delete searchDto.teacher_routine;                       // drop the virtual field
const opts = findOptions({ page, queryDto: searchDto, customQuery: [
  { operation: 'in',  column: 'class_id', value: classIds,  operator: 'and' },
  { operation: 'neq', column: 'state',    value: DraftEnum,  operator: 'and' },
]});
const [rows, count] = await this.repo.findAndCount(opts);
```

<a id="ch15"></a>

## Chapter 15. The response envelope & Swagger

```ts
class Page<T> {
  elements: T[];
  totalElements: number;   // full count, ignores skip/take (from findAndCount)
  pageable: IPage;         // literally the `page` object you passed in
}
```

For Swagger, subclass `Page` and re-declare `elements` with a concrete type — the
pattern used throughout this repo (e.g.
[`batch/dto/response.dto.ts`](src/teacher-app/batch/dto/response.dto.ts)):

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@sksharma72000/nestjs-search-page';

export class BatchResponseDto { /* @ApiProperty fields … */ }

export class BatchPage extends Page<BatchResponseDto> {
  @ApiProperty({ type: [BatchResponseDto] })
  elements: BatchResponseDto[];
}
```

Then `@ApiResponse({ type: BatchPage })` and `getAll(): Promise<BatchPage>`.

---
---

<a id="part-iv"></a>

# Part IV — The cookbook

<a id="ch16"></a>

## Chapter 16. Recipes

Each recipe is a self-contained DTO fragment plus the request that drives it.

<a id="r16-1"></a>

### 16.1 A search box over several columns

```ts
@IsOptional() @PageSearch() first_name: string;
@IsOptional() @PageSearch() last_name: string;
@IsOptional() @PageSearch() full_name: string;
@IsOptional() @PageSearch() email: string;
```
```
?full_name=ram          →  WHERE full_name LIKE '%ram%'
```
All four default to `like` + `or`, so a single term against any one of them can be
OR-grouped; they also get AND-ed with any strict filters present.

<a id="r16-2"></a>

### 16.2 A strict filter (id / FK / enum / boolean)

```ts
@IsOptional() @Type(() => Number) @PageSearch({ operation: 'eq', operator: 'and' })
class_id: number;

@IsOptional() @PageSearch({ operation: 'eq', operator: 'and' })
status: StatusEnum;
```

<a id="r16-3"></a>

### 16.3 Multi-value / enum multi-select

```ts
@IsOptional() @PageSearch({ operation: 'in', operator: 'and' })
state: StudentStateEnum[];
```
```
?state=Current&state=Passout      OR      ?state=Current,Passout
```

<a id="r16-4"></a>

### 16.4 A date (or numeric) range

```ts
@IsOptional() @PageSearch({ operation: 'between', operator: 'and' })
dob_en: string[];
```
```
?dob_en=2010-01-01&dob_en=2010-12-31
```
⚠️ Needs **two** values; a single value is silently ignored.

<a id="r16-5"></a>

### 16.5 Lower/upper bound only

```ts
@IsOptional() @PageSearch({ operation: 'gteq', operator: 'and' }) score_from: number;
@IsOptional() @PageSearch({ operation: 'lteq', operator: 'and' }) score_to:   number;
```
⚠️ Use **different columns/properties** — two AND conditions on the same column collide
(Chapter 26). Here `score_from`/`score_to` must map to the *same* DB column only via
`column`, which would collide; prefer `between`, or a `raw` fragment
(`value: (v) => \`score >= ${Number(v)}\``), for a true two-sided range on one column.

<a id="r16-6"></a>

### 16.6 Presence / absence

```ts
@IsOptional() @PageSearch({ column: 'ledger_id', operation: 'isNotNull', operator: 'and' })
has_ledger: boolean;                         // ?has_ledger=anything → ledger_id IS NOT NULL

@IsOptional() @PageSearch({ column: 'employee.id', operation: 'isNull', operator: 'and', is_nested: true })
unlinked: boolean;
```
⚠️ Fires on **key presence**, not value.

<a id="r16-7"></a>

### 16.7 Filter by a related table's column

```ts
@IsOptional() @PageSearch({ column: 'class.name', is_nested: true })
class_name: string;

@IsOptional() @Type(() => Number)
@PageSearch({ column: 'student.class_id', is_nested: true, operation: 'eq', operator: 'and' })
class_id: number;
```

<a id="r16-8"></a>

### 16.8 Embed a relation on demand

```ts
@IsOptional() @PageSearch({ is_relational: true }) class: boolean;
@IsOptional() @PageSearch({ column: 'parents.parent', is_relational: true, is_nested: true }) parents: boolean;
```
```
?class=true&parents=true
```

<a id="r16-9"></a>

### 16.9 "Today" / computed filters

```ts
@IsOptional()
@PageSearch({ column: 'check_time', operation: 'raw', operator: 'and',
              value: `DATE(check_time) = CURDATE()` })
today: boolean;

@IsOptional()
@PageSearch({ column: 'check_time', operation: 'raw', operator: 'and',
              value: `DATE(check_time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)` })
yesterday: boolean;
```

<a id="r16-10"></a>

### 16.10 Computed filter from the request value (function `value`)

Full mechanics in [§10.7](#s10-7). The function is called with the client's value; a
non-empty string is spliced into the `WHERE`; returning `undefined` / `''` drops the
condition for that request.

```ts
@IsOptional()
@PageSearch({
  column: 'start', operation: 'raw', operator: 'and',
  value: (date) => {
    if (!date) return;                          // no value ⇒ filter simply not applied
    const d = new Date(date);
    return `(YEAR(start) = ${d.getFullYear()} AND MONTH(start) = ${d.getMonth() + 1})`;
  },
})
month: string;                                  // ?month=2026-08-01
```

⚠️ In `customQuery` the function is **not** evaluated — use a plain string there.

<a id="r16-11"></a>

### 16.11 Strict filter *and* OR-groupable search on the same column

```ts
@IsOptional() @PageSearch({ operation: 'eq', operator: 'and' })
user_number: string;                        // exact PIN, relied on elsewhere

@IsOptional() @PageSearch({ column: 'user_number' })   // default like + or
pin_search: string;                         // OR-groups with name fields
```
Real case: [`biometric/dto/search.dto.ts`](src/modules/application/attendance/biometric/dto/search.dto.ts).
See Chapter 26 for *why* the second field is necessary.

<a id="r16-12"></a>

### 16.12 Sparse fieldset (return only some columns)

```ts
export class StudentSelectDto {
  @IsOptional() @PageSelect({ select: 'first_name' }) fn: boolean;
  @IsOptional() @PageSelect({ select: 'roll_no' })    rn: boolean;
  @IsOptional() @PageSelect({ select: 'class', type: 'relational' }) cls: boolean;
}
```
```ts
findAllByPage<Student>({ repo, page, queryDto: search, selectDto: select });
```
```
?fn=true&rn=true&cls=true      → SELECT id, first_name, roll_no  (+ class relation)
```

<a id="r16-13"></a>

### 16.13 Fetch one by id **or** business key

Chapter 13 — `findOne` with two `operator: 'or'` `customQuery` entries and no `id` arg.

<a id="r16-14"></a>

### 16.14 Force tenancy / visibility (client cannot override)

```ts
// controller: inject from the token
searchDto.staff_id = staff_id;
// or service: customQuery
findAllByPage({ repo, page, queryDto: search, customQuery: [
  { column: 'can_view', value: YesNoEnum.Yes, operation: 'eq', operator: 'and' },
]});
```

<a id="r16-15"></a>

### 16.15 "Give me everything" (bounded export)

```ts
pageable._start = 0;
pageable._end   = 1000;
const opts = findOptions({ page: pageable, queryDto: searchDto });
return this.repo.find(opts);
```

<a id="r16-16"></a>

### 16.16 Default sort per endpoint

```ts
// controller
pageDto._sort  = pageDto._sort  ?? 'created_at';
pageDto._order = pageDto._order ?? SortDirection.DESC;
```

---
---

<a id="part-v"></a>

# Part V — Customization & extension

The library is deliberately thin: it produces a `FindManyOptions`. Every customization
is *"intercept before"* or *"take over after"*.

<a id="ch17"></a>

## Chapter 17. Customizing in the controller

The controller's job is DTO binding + `ValidationPipe`. Customize by **mutating the
DTOs before delegating** — inject server-known values so the client can't override them:

```ts
@Get()
async getAll(
  @AuthUser('staff_id') staff_id: number,
  @Query() searchDto: SearchDto,
  @Query() pageDto: PageDto,
): Promise<NoticePage> {
  searchDto.staff_id = staff_id;           // force tenancy
  searchDto.group    = true;               // force a relation-load
  pageDto._sort  = 'created_at';           // force default sort
  pageDto._order = SortDirection.DESC;
  return this.service.getAll(pageDto, searchDto);
}
```
([`teacher-app/notice/controller.ts`](src/teacher-app/notice/controller.ts))

⚠️ Several controllers in this repo `import { findOptions }` and even call it, then
ignore the result and delegate to the service anyway (e.g.
[`feed/chat/controller.ts`](src/modules/feed/chat/controller.ts)). That is dead code —
**do the real work in the service.**

<a id="ch18"></a>

## Chapter 18. Customizing in the service

The main extension surface. Patterns, in rough order of frequency:

<a id="r18-1"></a>

### 18.1 Wrap `findAllByPage` and post-process rows

[`common/services/common.service.ts`](src/common/services/common.service.ts) —
`CommonService<T>`, extended by ~179 services:

```ts
async getAll(page: PageDto, searchDto: any, selectDto?: any): Promise<Page<T>> {
  const { elements, ...rest } = await findAllByPage<T>({
    repo: this._repo, page, queryDto: searchDto, selectDto,
  });
  return { elements: elements.map(this.transformTo), ...rest };
}
```

<a id="r18-2"></a>

### 18.2 Override `getAll`, branch on a virtual field, then `super.getAll(...)`

The dominant override pattern (~19 services). A **virtual** field carries an
instruction, not a column filter; resolve it to real conditions and `delete` it before
it reaches the builder:

```ts
async getAll(page: PageDto, searchDto: SearchDto, selectDto?: any): Promise<Page<ExmSubject>> {
  const { teacher_routine } = searchDto;
  if (teacher_routine) {
    const subjectIds = (await this.repo.manager.findBy(AcademicTimeline, { staff_id: teacher_routine }))
      .map(t => t.subject_id);
    delete searchDto.teacher_routine;                   // ⚠ remove the virtual field
    const opts = findOptions({ page, queryDto: searchDto, customQuery: [
      { operation: 'in', column: 'subject_id',  value: subjectIds,           operator: 'and' },
      { operation: 'in', column: 'post_status', value: [Pending, Inprogress], operator: 'and' },
    ]});
    const [data, count] = await this.repo.findAndCount(opts);
    return { elements: data, totalElements: count, pageable: page };
  }
  return super.getAll(page, searchDto, selectDto);
}
```
([`exam/subject/service.ts`](src/modules/exam/subject/service.ts); same shape in
`exam/routine`, `exam/cas`, `academic/timeline`, `academic/class-subject`.)

<a id="r18-3"></a>

### 18.3 Rewrite the DTO before delegating (one param → several)

```ts
if (searchDto.class_subject_id) {
  const cs = await this.classSubjectRepo.findOneBy({ id: searchDto.class_subject_id });
  searchDto.class_id   = cs.class_id;
  searchDto.subject_id = cs.subject_id;
  delete searchDto.class_subject_id;
}
return super.getAll(pageable, searchDto);
```
([`academic/syllabus/syllabus.service.ts`](src/modules/academic/syllabus/syllabus.service.ts))

<a id="r18-4"></a>

### 18.4 `findOptions` → run against a *different* entity

```ts
searchDto.state = StudentStateEnum.Current;
const findStudent = findOptions({ queryDto: searchDto });        // no page ⇒ all rows
const students = await this.repo.manager.find(StudentInfo, findStudent);
```
([`teacher-app/student-attendance/service.ts`](src/teacher-app/student-attendance/service.ts) —
`repo` is the `StudentAttendance` repo, the query is against `StudentInfo`.)

<a id="r18-5"></a>

### 18.5 `findOptions` → mutate the options, then run

```ts
const findOption = findOptions<RepoCollection>({ page: pageable, queryDto: searchDto, customQuery });
if (searchDto.deleted_at) findOption.withDeleted = true;
const [elements, count] = await this.repo.findAndCount(findOption);
```
([`repo/collection/service.ts`](src/modules/repo/collection/service.ts))

<a id="r18-6"></a>

### 18.6 `findOptions` → spread `where` into a bulk `update`

```ts
const filterWhere = findOptions({ queryDto: clearFilter });
await this.repo.update(
  { mark_card: YesNoEnum.Yes,
    ...(Array.isArray(filterWhere.where) ? filterWhere.where[0] : filterWhere.where) },
  { mark_card: YesNoEnum.No },
);
```
([`library/patron/patron.service.ts`](src/modules/library/patron/patron.service.ts) —
note `where` may be an array; take `[0]` for `update`.)

<a id="r18-7"></a>

### 18.7 Cap the page size for an "all rows" variant

```ts
pageable._start = 0;
pageable._end   = 1000;
const opts = await findOptions({ page: pageable, queryDto: searchDto });
return this.repo.find(opts);
```
([`academic/class-subject/service.ts`](src/modules/academic/class-subject/service.ts))

<a id="r18-8"></a>

### 18.8 `findOne` variants — extra where, alternate keys

```ts
const [modal] = await this.repo.find(findOptions<StudentLog>({
  queryDto: searchDto,
  customQuery: [{ column: 'student_id', value: id, operation: 'eq', operator: 'and' }],
}));
```
([`student/log/service.ts`](src/modules/student/log/service.ts))

<a id="r18-9"></a>

### 18.9 Merge the paged result with data from elsewhere

```ts
const studentList = await findAllByPage<StudentInfo>({
  repo: this.studentRepo, queryDto: searchDto, page,
  customQuery: [{ column: 'id', operation: 'in', operator: 'and', value: scholarStudentIds }],
});
return { ...studentList, elements: studentList.elements.map(s => {
  s['total_allotment'] = allotMap.get(s.id) ?? 0; return s;
}) };
```
([`bill/scholar-percent/service.ts`](src/modules/bill/scholar-percent/service.ts))

<a id="r18-10"></a>

### 18.10 Plain service, no `CommonService`

```ts
async get(page: PageDto, searchDto: DepartmentSearchDto): Promise<Page<EmployeeDepartment>> {
  return findAllByPage({ repo: this.departmentRepo, page, queryDto: searchDto });
}
```
([`employee/department/service.ts`](src/modules/employee/department/service.ts); also
`extra/address`, `employee/qualification`, `store/template`.)

<a id="ch19"></a>

## Chapter 19. The repository / manager level

There is **no** repository-level integration, and none is needed — the functions take a
`Repository<T>` as a plain argument. The custom repository classes in this repo
(`LibraryBookRepository extends Repository<LibraryBook>`, etc. under
`*/report/repositories/`) are hand-written QueryBuilder aggregations and **do not** use
this library.

If you want a repository-scoped helper, wrap `findOptions` in a method on your custom
repository and call `this.find(...)` / `this.manager.find(...)` — identical to the
service patterns above. You can also run the generated options against **any** entity
through `repo.manager.find(OtherEntity, options)` (18.4).

<a id="ch20"></a>

## Chapter 20. Composing with QueryBuilder

When you need joins or aliases the model can't express, generate the `where`/paging with
`findOptions()` and hand them to a `QueryBuilder`:

```ts
const opt = findOptions<AcademicTimeline>({ page: pageable, queryDto: searchDto });

const [list, total] = await this.repo.createQueryBuilder('at')
  .innerJoin('academic_class_session', 'acs',
             'at.class_id = acs.academicClassId AND at.session_id = acs.academicSessionId')
  .leftJoinAndSelect('at.period', 'period')      // needed if a `raw` fragment references `period.*`
  .where(opt.where)                              // reuse the generated where
  .take(opt.take).skip(opt.skip)                 // reuse the generated paging
  .getManyAndCount();

return { elements: list, totalElements: total, pageable };
```
([`teacher-app/timeline/service.ts`](src/teacher-app/timeline/service.ts) /
[`academic/timeline/service.ts`](src/modules/academic/timeline/service.ts))

Notes:

- `opt.where` is a `FindOptionsWhere` (object or array of objects). TypeORM's
  `.where(object)` accepts it; for an array (OR present) you may need
  `qb.where(opt.where)` then confirm the generated SQL, or iterate the array with
  `orWhere`.
- Any alias a `raw` fragment references (`period.start_time`) must be joined into the
  `QueryBuilder`.
- `opt.order` (a nested object) does not drop straight into `qb.orderBy()` — translate
  it, or set the order on the builder yourself.

---
---

<a id="part-vi"></a>

# Part VI — Field guide to this codebase

<a id="ch21"></a>

## Chapter 21. Usage statistics

School backend, package v3.2.4:

| Metric | Count |
|---|---|
| files declaring `@PageSearch` | **185** |
| services extending `CommonService` | **179** |
| services overriding `getAll` | ~19 |
| `operator: 'and'` occurrences | 759 |
| `operator: 'or'` occurrences | 3 |

Operation frequency: `eq` ×626 · `in` ×65 · `raw` ×20 · `between` ×17 ·
`isNotNull` ×12 · `gteq` ×8 · `isNull` ×5 · `neq` ×4 · `notIn` ×2 · `lteq` ×2 ·
`like` (explicit) ×2 · `notLike` ×1. (`like` is the default, so most `like` filters
carry no explicit `operation`.)

Reading: the overwhelmingly common pattern is a **strict `eq` + `and` filter**; free-text
`like` fields are second (implicit); `raw` is a small but real slice for date logic.

<a id="ch22"></a>

## Chapter 22. Catalogue of `@PageSearch` combinations

| Pattern | Real examples | Meaning |
|---|---|---|
| bare `@PageSearch()` | `first_name`, `message`, `name` | `LIKE %v%`, OR — search-box field |
| `{ operation:'eq', operator:'and' }` | `class_id`, `section_id`, `status`, `state` | strict filter (by far the most common) |
| `{ operation:'in', operator:'and' }` | `state: Enum[]`, `flow: string[]`, `attendance: Enum[]` | multi-value filter (array or CSV) |
| `{ operation:'between', operator:'and' }` | `dob_en: string[]`, `check_time: Date[]` | range; needs a 2-element array |
| `{ operation:'gteq', operator:'and' }` | exam `oresult` / `oexm` score & date fields | lower-bound filter |
| `{ operation:'isNotNull'/'isNull', operator:'and' }` | `ledger_id`, `email`, `phone`, `starreds.user_id`, nested `employee.id` | presence / absence (fires on key presence) |
| `{ operation:'neq', operator:'and' }` | routine `state ≠ Draft` (in `customQuery`) | exclude a value |
| `{ column:'a.b', is_nested:true }` | `class_name→class.name`, `staff_name→staff.name`, `student.class_id` | filter a relation's column |
| `{ is_relational:true }` | `class`, `section`, `subject`, `staff`, `device`, `biometric` | eager-load relation on `?field=true` |
| `{ column:'a.b', is_relational:true, is_nested:true }` | `parents.parent`, `siblings.sibling.class`, `subject.books`, `product.image` | eager-load a nested relation path |
| `{ column, operation:'raw', operator:'and', value:'<SQL>' }` | `birthday`, `today`, `yesterday`, `this_month`, `current_schedule` | static SQL toggle (dates vs `CURDATE()`) |
| `{ column, operation:'raw', …, value:(v)=>'<SQL>' }` | `attendance_date`, calendar `date` | dynamic SQL from the request value |
| two properties → one `column` | `user_number` (`eq`/`and`) + `pin_search` (`like`/`or`, `column:'user_number'`) | strict filter *and* OR-groupable search on one DB column |
| virtual field, no meaningful `@PageSearch` | `session_enabled`, `teacher_routine`, `teacher_cas`, `class_subject_id`, `is_read` | read in the service, resolved to real conditions, then `delete`d |

<a id="ch23"></a>

## Chapter 23. Catalogue of function-call patterns

| Call | Where | Purpose |
|---|---|---|
| `findAllByPage({ repo, page, queryDto })` | plain services, `CommonService.getAll` | the standard list endpoint |
| `findAllByPage({ …, selectDto })` | `CommonService.getAll`, student modules | + sparse fieldsets |
| `findAllByPage({ …, customQuery })` | `datavalue`, `scholar-percent`, `student/log`, exam modules | + forced server conditions |
| `findOne({ id, repo, queryDto })` | `CommonService.getById`, `store/template` | fetch-by-id honouring the search DTO |
| `findOne({ id, repo, selectDto })` | `student/current` | fetch-by-id with a sparse fieldset |
| `findOne({ repo, queryDto, customQuery:[{id,'or'},{alt,'or'}] })` | `account/voucher` | fetch by id **or** business key |
| `findOptions({ page, queryDto })` → `repo.findAndCount` | exam modules, `repo/collection` | run + custom post-processing / extra options |
| `findOptions({ queryDto })` → `manager.find(Other, opts)` | `teacher-app/student-attendance`, `student/attendance` | reuse the where against another table |
| `findOptions(...).where` → `.createQueryBuilder().where(...)` | `timeline` (both) | need real joins / aliases |
| `findOptions(...)` → mutate (`withDeleted`) → run | `repo/collection` | add TypeORM options |
| `findOptions({ queryDto })` → spread `where[0]` into `repo.update()` | `library/patron` | bulk update with the search filter |
| `findOptions({ page })` with `_start=0,_end=1000` → `repo.find` | `academic/class-subject` | bounded "everything" list |

<a id="ch24"></a>

## Chapter 24. Catalogue of controller patterns

- **Standard.** Two `@Query()` args (search + page);
  `@UsePipes(new ValidationPipe({ whitelist:true, transform:true }))`; delegate to
  `service.getAll(page, search)`. Detail route: `@Get(':id')` + one `@Query()` search
  DTO → `service.getById(id, search)`.
- **Forced params.** Mutate `searchDto` / `pageDto` from `@AuthUser(...)` or route
  context before delegating ([`teacher-app/notice/controller.ts`](src/teacher-app/notice/controller.ts)).
- **Wrapper query DTO.** `@Query() query: StudentQueryDto` where `query.select` /
  `query.filter` are JSON strings `@Transform`ed into objects, then
  `service.getAll(page, query.filter, query.select)`
  ([`student/current/controller.ts`](src/modules/student/current/controller.ts)).
- **Swagger.** `@ApiResponse({ type: XxxPage })` where `XxxPage extends Page<XxxResponseDto>`.

---
---

<a id="part-vii"></a>

# Part VII — Under the hood

<a id="ch25"></a>

## Chapter 25. How the `where` is assembled

Annotated pseudocode of `findOptions()` → `_getMetaQuery()`
([`../nestjs-search-page/project/src/models/entity.ts`](../nestjs-search-page/project/src/models/entity.ts)):

```
buckets = { and: [], or: [] }
relations = []
select = {}

# ── 1. walk the search DTO ───────────────────────────────────────────────
for each key in queryDto:
    meta = Object.assign({}, Reflect.getMetadata(SK_PAGE_SEARCH, queryDto, key))
    if meta:                                        # ALWAYS truthy — {} when no metadata
        if meta.column contains '.':  meta.is_nested ??= true

        if meta.is_relational:
            relations.push(meta.column)            # NO where condition, next key
            continue

        if meta.operation == 'raw':
            value = (typeof meta.value == 'function')
                      ? meta.value(queryDto[key])   # ← function called with the client's value
                      : meta.value                  # static SQL fragment
        else:
            value = queryDto[key]                   # the request value (function value discarded)

        if value == undefined  or  String(value) == '':  continue   # ← function may return ''/undefined here to opt out

        cond = switchCondition(meta.operation ?? 'like', value)      # Like/Equal/In/Raw/…
        target = meta.is_nested ? nest(meta.column.split('.'), cond)
                                : { [meta.column]: cond }
        # if meta.column is undefined (no @PageSearch on this key) buildWhere bails → no-op
        buckets[ meta.operator ?? 'or' ].push(target)

    else:
        # DEAD in v3.2.4: `meta` above is never falsy, so a @PageSelect that is
        # mixed into the search DTO (rather than a dedicated selectDto) is ignored.
        selMeta = Reflect.getMetadata(SK_IS_SELECT, queryDto, key)
        if selMeta and queryDto[key] == true:  addSelect(selMeta)

# ── 2. walk the dedicated select DTO ─────────────────────────────────────
for each key in selectDto:
    selMeta = Reflect.getMetadata(SK_IS_SELECT, selectDto, key)
    if selMeta and (selectDto[key] === true or selectDto[key] === 'true'):
        addSelect(selMeta)          # column → nested select (+ parent relation)
                                    # relational → relations.push(select)

# ── 3. merge customQuery[] ──────────────────────────────────────────────
for each c in customQuery:
    if 'select' in c:  addSelect(c)
    else:
        if c.column contains '.':  c.is_nested ??= true
        buckets[ c.operator ?? 'or' ].push( buildWhere(c) )

# ── 4. combine the buckets ─────────────────────────────────────────────
if buckets.or is empty:
    where = [ deepMerge(buckets.and) ]                         # single AND object
else:
    andObj = deepMerge(buckets.and)
    where = buckets.or.map(orObj =>
              buckets.and.length ? deepMerge(orObj, andObj) : orObj)

# ── 5. select & return ────────────────────────────────────────────────
if select has any keys:  select.id = true
else:                    select = undefined

return {
  where,
  order:     page ? Sort.from(page._sort, page._order).asKeyValue() : undefined,
  relations,
  select,
  skip:      page ? PageRequest.from(page).getSkip() : undefined,   # _start
  take:      page ? PageRequest.from(page).getTake() : undefined,   # _end − _start
}
```

Helpers:

- `nest(['a','b'], cond)` → `{ a: { b: cond } }`.
- `Sort.asKeyValue()` splits `_sort` and `_order` on `,`, zips them, and splits each
  key on `.` for nested order.
- `PageRequest.from()` coerces `_start`/`_end` to numbers, clamps `_start ≥ 0`, and
  falls back to `DEFAULT_PAGE_SIZE` (`10`) when `_end` is missing/invalid.

<a id="ch26"></a>

## Chapter 26. The AND / OR merge model, explained

This is the behaviour that surprises people, so here it is in isolation.

### The rule

After every condition has been dropped into the `and` bucket or the `or` bucket:

1. Each **OR** condition becomes its **own object** in a `where` **array**. TypeORM
   treats an array of where-objects as `OR`.
2. All **AND** conditions are **deep-merged into a single object**.
3. That single AND object is then **merged into every OR branch**.

### Worked examples

Request with OR fields `a`, `b` and AND fields `x`, `y`:

```
where = [ { a, x, y }, { b, x, y } ]
      ≡  (a AND x AND y) OR (b AND x AND y)
```

Only AND fields `x`, `y`:

```
where = { x, y }
      ≡  x AND y
```

Only OR fields `a`, `b`:

```
where = [ { a }, { b } ]
      ≡  a OR b
```

### Why the defaults are what they are

`@PageSearch()` defaults to `operator: 'or'` **and** `operation: 'like'`. That is
exactly right for a **search box**: several text columns, any one match counts, and the
term is a substring. The moment you add real **filters** you give them
`operator: 'and'` so they *constrain* every branch rather than *widen* the result.

### The collision foot-gun

Because step 2 **deep-merges** AND conditions into one object, **two AND conditions on
the same column overwrite each other** — last one wins. You cannot express
`col >= x AND col <= y` as two separate `@PageSearch({ column: 'col', ... })`. Use
`operation: 'between'`, or a single `raw` fragment, or two distinct columns.

### The "strict field poisons the search" foot-gun

If one request carries a strict `{ operation:'eq', operator:'and' }` field **and**
default-`or` fields **that map to the same DB column**, the strict value is AND-merged
into *every* OR branch — so a "name **or** exact code" search silently requires the code
to also equal the term, guaranteeing zero rows. The fix used in
[`biometric/dto/search.dto.ts`](src/modules/application/attendance/biometric/dto/search.dto.ts)
is a **parallel property** (`pin_search`) with the default `or` + `like` and an explicit
`column: 'user_number'`, so it OR-groups with the name fields instead of colliding with
the strict `user_number` filter.

<a id="ch27"></a>

## Chapter 27. Operation → TypeORM operator reference

| `operation` | TypeORM produced | Value handling / notes |
|---|---|---|
| `'like'` *(default)* | `Like('%value%')` | substring match |
| `'eq'` | `value` (raw equality) | returned as-is → TypeORM equality |
| `'neq'` | `Not(Equal(value))` | |
| `'in'` | `In(value)` | array kept; `"a,b,c"` string → `split(',')`; scalar → `[value]` |
| `'notIn'` | `Not(In(value))` | same value handling as `in` |
| `'gt'` | `MoreThan(value)` | |
| `'gteq'` | `MoreThanOrEqual(value)` | |
| `'lt'` | `LessThan(value)` | |
| `'lteq'` | `LessThanOrEqual(value)` | |
| `'between'` | `Between(value[0], value[1])` | **requires** array length ≥ 2, else condition is **skipped** |
| `'notBetween'` | `Not(Between(value[0], value[1]))` | same requirement |
| `'isNull'` | `Raw(alias => \`${alias} IS NULL\`)` | request value ignored; fires on key presence |
| `'isNotNull'` | `Raw(alias => \`${alias} IS NOT NULL\`)` | request value ignored; fires on key presence |
| `'notLike'` | `Not(Like('%value%'))` | |
| `'raw'` | `Raw(() => value)` | `value` is a SQL string, **or** a `Function` evaluated with the request value; must yield a valid fragment |
| *(unset)* + array value | `In(value)` | a `string[]` value with no `operation` becomes `in` |

`nest`ing: with `is_nested`, the produced operator is wrapped in `{ a: { b: <operator> } }`
according to `column.split('.')`.

---
---

<a id="appendices"></a>

# Appendices

<a id="appx-a"></a>

## Appendix A. Gotchas & limitations

1. **Default is `LIKE %v%` + `OR`, not `= / AND`.** Every id / FK / enum / boolean /
   date filter needs `{ operation: 'eq', operator: 'and' }` (or `'in'`, `'between'`, …).
2. **AND-merge collisions.** Multiple `operator:'and'` conditions on the **same column**
   deep-merge — last wins. No `col >= x AND col <= y` via two decorators; use `between`
   / `raw` / distinct columns.
3. **AND is distributed into every OR branch.** A strict `eq/and` field combined in one
   request with default-`or` fields on the *same column* forces that exact value onto
   all branches → usually zero rows. (See Chapter 26 and the `pin_search` workaround.)
4. **`raw` fires on key presence, not value.** `?birthday=false` still applies a
   static-string `raw` fragment. A **function** `value` (only honoured with
   `operation: 'raw'`, only on a `queryDto` — never in `customQuery`) is called with the
   client's value and may `return undefined`/`null`/`''` to *disable* the condition for
   that request; any non-empty string it returns is spliced verbatim (§10.7).
   **You own SQL-injection safety for `raw`** — only interpolate validated input.
5. **`is_relational` also fires on key presence** — `?class=false` still eager-loads
   `class`.
6. **`is_nested` filter ≠ relation load.** `column: 'post.title'` filters via `post`
   (implicit join) but does not return it — add `is_relational: true` / a `@PageSelect`
   / `relations`.
7. **`between` / `notBetween` silently no-op** unless `value` is an array of length ≥ 2.
8. **Query strings are strings.** Without `transform: true` + `@Type(() => Number)`,
   `eq` on a numeric column compares `"5"` to `5`. `@Type(() => Boolean)` maps the
   string `"false"` to `true` (non-empty string) — for real booleans prefer
   `@Transform(({ value }) => value === 'true' || value === true)`.
9. **`@PageSelect` only works in a dedicated `selectDto`** (activator: `true` or the
   string `"true"`). Mixing `@PageSelect` into the search DTO is silently ignored in
   v3.2.4 — the `SK_IS_SELECT` branch of the `queryDto` loop is unreachable
   (`Object.assign({}, undefined)` is a truthy `{}`).
10. **`_end` is an absolute row index, not a page size.** Page 3 of 20 ⇒
    `_start=40&_end=60`.
11. **`findOne` mutates its `customQuery` argument.** Pass a fresh array literal.
12. **`select` always re-adds `id`.** Any active selection ⇒ `id` is returned too.
13. **`totalElements`** comes from `findAndCount` — with to-many `relations` loaded,
    TypeORM's count can behave in the usual `findAndCount` + joins ways; verify counts
    if you eager-load collections.
14. **`whitelist: true` drops undecorated params** — you cannot "pass through" an
    arbitrary filter with no DTO field.
15. **No `exports` map in the package** — sub-path imports (`/constants`,
    `/interfaces`, …) resolve by classic Node resolution against real folders. They work
    today; don't rely on deeper paths than Appendix C lists.
16. **The published README is partly stale** — it claims booleans are auto-treated as
    relational "unless set to false". In v3.2.4 there is no type inference: set
    `is_relational: true` explicitly.

<a id="appx-b"></a>

## Appendix B. Troubleshooting table

| Symptom | Likely cause | Fix |
|---|---|---|
| `?id=5` returns unrelated rows | default `like`/`or` on an id field | `@PageSearch({ operation: 'eq', operator: 'and' })` |
| numeric `eq` filter never matches | query string not coerced | `ValidationPipe({ transform: true })` + `@Type(() => Number)` |
| relation missing from the response | filtered via `is_nested` only | add `is_relational: true` (or a `@PageSelect` / `relations`) |
| relation loaded even when not asked | `is_relational` fires on key presence; client sent `field=false` | send the key only to opt in, or gate it in the service |
| "name + strict code" search returns nothing | strict `eq/and` field AND-distributed onto OR branches | add a parallel default-`or` `like` field on the same `column` |
| `between` filter ignored | fewer than 2 values | send two params: `?d=lo&d=hi`; DTO type is an array |
| `raw` produces a SQL error | function `value` returned `undefined` / bad fragment | always return a valid SQL string; guard inputs |
| unknown query param throws / leaks | no `whitelist` | `ValidationPipe({ whitelist: true })` |
| `findOne` accumulates `id` conditions across calls | shared `customQuery` array reference | pass a fresh `[]` literal each call |
| `Error: One of (page\|queryDto\|selectDto\|customQuery) must be defined` | all args empty | pass at least one; for `findOne`, pass `id` |
| second `_sort` column has no direction | `_order` shorter than `_sort` | give `_order` the same number of comma-separated entries |
| page size wrong | treated `_end` as a size | it's an absolute row index: `take = _end − _start` |

<a id="appx-c"></a>

## Appendix C. Import / export map

```ts
// ── package root (barrel) ──────────────────────────────────────────────
import {
  PageSearch, PageSelect,               // decorators
  findAllByPage, findOne, findOptions,  // functions
  Page,                                 // class (runtime — for `extends`)
  IPage, IPageSearch, IPageSelect,      // types
} from '@sksharma72000/nestjs-search-page';

// ── /constants ────────────────────────────────────────────────────────
import { SortDirection } from '@sksharma72000/nestjs-search-page/constants';   // enum ASC|DESC
import type { Operation, Operator } from '@sksharma72000/nestjs-search-page/constants';
// also exported: SK_IS_RELATIONAL, SK_IS_SELECT, SK_PAGE_SEARCH (metadata keys)

// ── /interfaces ───────────────────────────────────────────────────────
import type {
  IPage, IPageSearch, IPageSelect,
  IFindAllByPage, IFindOne, IFindOptionByPage,
  IPageable, ISortable,
} from '@sksharma72000/nestjs-search-page/interfaces';

// ── /models ───────────────────────────────────────────────────────────
import { Page, PageRequest, Sort, findAllByPage, findOne, findOptions }
  from '@sksharma72000/nestjs-search-page/models';

// ── /decorators ───────────────────────────────────────────────────────
import { PageSearch, PageSelect } from '@sksharma72000/nestjs-search-page/decorators';
```

Idiomatic usage in this repo: decorators, functions and `Page` from the **root**;
`SortDirection` from **`/constants`**.

<a id="appx-d"></a>

## Appendix D. Full type definitions

```ts
// ── constants ─────────────────────────────────────────────────────────
type Operation =
  | 'eq' | 'neq' | 'in' | 'notIn'
  | 'gt' | 'gteq' | 'lt' | 'lteq'
  | 'like' | 'notLike'
  | 'between' | 'notBetween'
  | 'isNull' | 'isNotNull'
  | 'raw';

type Operator = 'and' | 'or';

enum SortDirection { ASC = 'ASC', DESC = 'DESC' }

// ── decorators ───────────────────────────────────────────────────────
interface IPageSearch {
  column?:        string;
  is_relational?: boolean;
  is_nested?:     boolean;
  operation?:     Operation;
  operator?:      Operator;
  value?: string | number | boolean | null
        | Array<string | number | boolean>
        | Function;
}

interface IPageSelect {
  select: string | object;
  type?: 'relational' | 'default';
}

// ── pagination ───────────────────────────────────────────────────────
interface IPage {
  _start: number;
  _end:   number;
  _sort:  string;
  _order: SortDirection;
}

// ── function arguments ───────────────────────────────────────────────
interface IFindAllByPage {
  repo: Repository<any>;
  page: IPage;
  queryDto?:   object;
  selectDto?:  object;
  customQuery?: IPageSearch[];
}

interface IFindOptionByPage {
  page?: IPage;
  queryDto?:   object;
  selectDto?:  object;
  customQuery?: IPageSearch[];
}

interface IFindOne {
  id?: string | number;
  repo: Repository<any>;
  queryDto?:   object;
  selectDto?:  object;
  customQuery?: IPageSearch[];
}

// ── return shape ─────────────────────────────────────────────────────
class Page<T> {
  elements: T[];
  totalElements: number;
  pageable: IPage;
}

// ── functions ────────────────────────────────────────────────────────
function findAllByPage<T>(args: IFindAllByPage): Promise<Page<T>>;
function findOne<T>(args: IFindOne): Promise<T | null>;
function findOptions<T>(args: IFindOptionByPage): FindManyOptions<T>;

// decorators
function PageSearch(options?: IPageSearch): PropertyDecorator;
function PageSelect(options?: IPageSelect): PropertyDecorator;
```

<a id="appx-e"></a>

## Appendix E. Glossary

| Term | Meaning |
|---|---|
| **Search DTO** | a class whose properties carry `@PageSearch`; describes the filterable surface; passed as `queryDto` |
| **Select DTO** | a class whose properties carry `@PageSelect`; describes sparse fieldsets; passed as `selectDto` |
| **Page DTO** | a class with the `IPage` shape (`_start`, `_end`, `_sort`, `_order`); passed as `page` |
| **the engine / the builder** | `findOptions()` — the pure function that turns DTOs into a `FindManyOptions` |
| **virtual field** | a DTO property whose value is an *instruction* to the service, not a column filter; resolved in an overridden `getAll` and `delete`d before the builder sees it |
| **`customQuery`** | conditions added in service code (tenancy, visibility) that the client cannot influence |
| **nested (`is_nested`)** | a condition or sort that targets a column on a relation, expressed with a dotted path |
| **relational (`is_relational` / `type:'relational'`)** | instruction to **join and return** a relation |
| **AND/OR merge** | the rule (Chapter 26) that OR conditions become array elements and AND conditions are merged into each |
| **`Page<T>`** | the response envelope `{ elements, totalElements, pageable }` |

<a id="appx-f"></a>

## Appendix F. Version & accuracy notes

- Documented against **v3.2.4** — the version vendored into every backend's
  `node_modules` in this monorepo (`project/package.json` and `publish/package.json`
  agree).
- Source of truth:
  [`../nestjs-search-page/project/src`](../nestjs-search-page/project/src) (TypeScript) →
  built to `publish/` → copied into consumers by the package's `build` script.
- The npm README / `project/README.md` predates the current engine in places (the
  "booleans are auto-relational" claim; a shorter `Operation` union). **This handbook
  reflects the built code actually running in `node_modules`.**
- History of note (git log): nested-relation support and nested sort order arrived
  around v3.1.x–v3.2.x; `raw` (string + function), `isNull` / `isNotNull`, `notLike`,
  `notIn`, `notBetween` are all present in v3.2.4.
- Consuming projects observed using this package in the monorepo: `school`,
  `student-api`, `kiosk-api`, `demo-school/backend`, `school-docker/backend`,
  `ai-app/ai-server`, `demo-school/ai-server`, and the package's own `example/` app.

---

*End of handbook.*
