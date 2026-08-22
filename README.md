# Memora Community Hub

[Memora](https://github.com/zaberhossen/Memora)-এর কমিউনিটি লেসন রিপোজিটরি। এখানে
যে JSON ফাইলগুলো আছে, সেগুলোই অ্যাপের **Explore** পেজে ডেক হিসেবে দেখা যায় —
একবার ডাউনলোড করলে ইন্টারনেট ছাড়াই পড়া যায়, শিডিউলিং করে FSRS।

কোনো ব্যাকএন্ড নেই, ডাটাবেজ নেই। একটা `catalog.json` আর কয়েকটা লেসন ফাইল — নতুন
ডেক যোগ করা মানে একটা পুল রিকোয়েস্ট।

```
memora-community-hub/
├── catalog.json    # সব লেসনের লিস্ট — অ্যাপের Explore পেজ এটাই পড়ে
├── lessons/        # মূল লেসন JSON ফাইলসমূহ
│   ├── hsc-bangla-01.json
│   ├── hsc-english-unit1.json
│   ├── physics-vector.json
│   ├── chemistry-mole-concept.json
│   ├── biology-cell-division.json
│   └── gk-bangladesh-liberation-war.json
└── README.md
```

> এখনকার লেসনগুলো **ডেমো কনটেন্ট** — ফরম্যাট বোঝানোর জন্য। আসল কনটেন্ট এলে
> এগুলো সরিয়ে দেওয়া হবে।

## অ্যাপকে এই ক্যাটালগে পয়েন্ট করা

Memora-র `.env`-এ একটা লাইন:

```
NEXT_PUBLIC_CATALOG_URL=https://raw.githubusercontent.com/zaberhossen/memora-community-hub/main/catalog.json
```

সেট না করলে অ্যাপ তার নিজের বান্ডিল করা `public/catalog.json` পড়ে। শেষ সফল
ফেচটা IndexedDB-তে ক্যাশ থাকে, তাই GitHub আনরিচেবল হলেও Explore খালি দেখায় না।

একটা মাত্র ডেক টেস্ট করতে চাইলে ক্যাটালগ লাগে না — Explore → **Custom import**-এ
লেসন ফাইলের raw URL পেস্ট করলেই হয়।

## লেসন ফাইলের ফরম্যাট

| ফিল্ড | দরকারি? | কী |
| --- | --- | --- |
| `lessonId` | হ্যাঁ | ইউনিক আইডি, ছোট হাতের অক্ষর ও হাইফেন। ফাইলের নামের সাথে মিলিয়ে রাখুন |
| `title` | হ্যাঁ | ডেকের নাম, যেভাবে Explore-এ দেখাবে |
| `subject` | না | `Bangla`, `English`, `Physics`… ফিল্টার চিপ এখান থেকে আসে |
| `author` | না | আপনার নাম বা হ্যান্ডল |
| `cards` | হ্যাঁ | অন্তত একটা কার্ড |

প্রতিটি কার্ড:

| ফিল্ড | দরকারি? | কী |
| --- | --- | --- |
| `id` | হ্যাঁ | এক লেসনের ভেতর ইউনিক |
| `front` | হ্যাঁ | প্রশ্ন বা শব্দ |
| `back` | হ্যাঁ | উত্তর |
| `hint` | না | ফ্লিপ করার আগে ছোট ইঙ্গিত |
| `note` | না | উত্তরের নিচে বাড়তি ব্যাখ্যা |
| `tags` | না | কার্ড-লেভেল লেবেল |
| `media` | না | `image` / `audio` / `video` — শুধু `https://` লিংক |

```json
{
  "lessonId": "physics-vector",
  "title": "Vectors — Definitions & Products",
  "subject": "Physics",
  "author": "Dr. Kamal Hossain",
  "cards": [
    {
      "id": "pv02",
      "front": "Write the dot product of A and B.",
      "back": "A · B = AB cos θ — a scalar.",
      "hint": "cos of the included angle",
      "tags": ["Formula"]
    }
  ]
}
```

মার্কডাউন বা HTML রেন্ডার হয় না — `front`/`back` প্লেইন টেক্সট হিসেবেই দেখানো হয়।

## ক্যাটালগ এন্ট্রির ফরম্যাট

`catalog.json`-এর `lessons` অ্যারেতে প্রতিটি লেসনের জন্য একটা এন্ট্রি:

```json
{
  "lessonId": "physics-vector",
  "title": "Vectors — Definitions & Products",
  "subject": "Physics",
  "author": "Dr. Kamal Hossain",
  "cardCount": 10,
  "description": "Dot and cross products, and the conditions worth memorising.",
  "tags": ["HSC", "Admission", "Formula"],
  "url": "https://raw.githubusercontent.com/zaberhossen/memora-community-hub/main/lessons/physics-vector.json"
}
```

- `lessonId`, `title`, `author` লেসন ফাইলের সাথে হুবহু মিলতে হবে
- `cardCount` = `cards` অ্যারের আসল দৈর্ঘ্য
- `url` অ্যাবসোলিউট raw URL — `main` ব্রাঞ্চের দিকে
- `tags` ফ্রি-ফর্ম, কিন্তু **নতুন ট্যাগ বানানোর আগে চলতি ট্যাগ খুঁজুন**।
  এখন ব্যবহার হচ্ছে: `HSC`, `SSC`, `Admission`, `Job Prep`, `BCS`, `Board Exam`,
  `Formula`, `Vocabulary`, `Grammar`, `Literature`, `Bangladesh`
- `description` অপশনাল, এক লাইন

## নতুন লেসন যোগ করার ধাপ

1. রিপোটা **fork** করুন, তারপর একটা ব্রাঞ্চ কাটুন — `add-hsc-chemistry-organic`
2. `lessons/`-এ নতুন ফাইল বানান। নাম দিন `<subject>-<topic>.json`, ছোট হাতের
   অক্ষরে — `hsc-bangla-02.json`, `physics-thermodynamics.json`
3. `catalog.json`-এ এন্ট্রি যোগ করুন। লিস্টটা `lessonId` অনুযায়ী সাজানো থাকে,
   নিজের এন্ট্রি সেই ক্রমেই বসান, আর `updatedAt` আজকের তারিখে বদলান
4. JSON ভ্যালিড কি না দেখে নিন:

   ```bash
   node -e "for (const f of require('fs').readdirSync('lessons')) JSON.parse(require('fs').readFileSync('lessons/'+f)); JSON.parse(require('fs').readFileSync('catalog.json')); console.log('valid')"
   ```

5. পুল রিকোয়েস্ট খুলুন। PR-এর বর্ণনায় লিখুন কোন ক্লাস/পরীক্ষার জন্য ডেকটা এবং
   কনটেন্ট কোথা থেকে এসেছে

### PR পাঠানোর আগে চেকলিস্ট

- [ ] ফাইলটা ভ্যালিড JSON, UTF-8, শেষে একটা নিউলাইন
- [ ] `lessonId` রিপোতে ইউনিক এবং ফাইলের নামের সাথে মেলে
- [ ] এক লেসনের ভেতর দুটো কার্ডের `id` এক নয়
- [ ] `catalog.json`-এর `cardCount` কার্ড সংখ্যার সমান
- [ ] `url` কাজ করে (`curl -I <url>` → `200`)
- [ ] উত্তর ভুল নেই — বোর্ড বই বা নির্ভরযোগ্য সোর্সে মিলিয়ে দেখা হয়েছে
- [ ] `media` লিংকগুলো `https://`, আর ফাইল ৮ MB-র নিচে
- [ ] কপিরাইটেড বই থেকে হুবহু কপি করা হয়নি — নিজের ভাষায় লেখা

## কার্ড লেখার কিছু নিয়ম

- **এক কার্ডে এক তথ্য।** পাঁচটা সূত্র একসাথে দিলে রিভিউতে কোনটা ভুলেছেন বোঝা যায় না
- **`front` ছোট রাখুন।** প্রশ্ন এক লাইনে না ধরলে সেটা আসলে দুইটা কার্ড
- **`back`-এ শুধু উত্তর।** ব্যাখ্যা থাকলে `note`-এ দিন
- **`hint` দিন উত্তর ফাঁস না করে** — "8 + 4 + 0 + 1" চলে, উত্তরটা লিখে দেওয়া চলে না
- **সংখ্যা ও তারিখে সোর্স মিলিয়ে নিন।** কমিউনিটি ডেকের একটা ভুল কার্ড হাজারবার
  রিভিউ হয়ে মুখস্থ হয়ে যায়

## রিভিউ প্রসেস

PR এলে দেখা হয় — JSON ভ্যালিড কি না, ক্যাটালগ এন্ট্রি ফাইলের সাথে মেলে কি না,
আর কার্ডের উত্তরগুলো ঠিক আছে কি না। ছোটখাটো ঠিকঠাক (ট্যাগ, বানান) মেইনটেইনার
নিজেই করে দিতে পারেন; কনটেন্ট নিয়ে প্রশ্ন থাকলে PR-এ কমেন্ট করা হবে।

মার্জ হওয়ার সাথে সাথেই ডেকটা লাইভ — raw ফাইল সরাসরি সার্ভ হয়, কোনো ডিপ্লয় নেই।
অ্যাপে পুরনো লিস্ট দেখলে Explore-এ pull-to-refresh করুন।

একই `lessonId`-তে আপডেট দিলে যাদের ডেকটা আগেই ডাউনলোড করা আছে, তাদের কার্ডের
টেক্সট বদলাবে কিন্তু রিভিউ শিডিউল ঠিক থাকবে। তাই **`id` বদলাবেন না** — নতুন `id`
মানে অ্যাপের কাছে নতুন কার্ড, আর পুরনো কার্ডের হিস্ট্রি মুছে যায়।

## লাইসেন্স

কনটেন্ট [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) —
কৃতজ্ঞতা স্বীকার করে যে কেউ ব্যবহার ও পরিবর্তন করতে পারবে। PR পাঠানো মানে আপনি
এই শর্তে কনটেন্ট দিচ্ছেন।

---

## English

Community lesson decks for [Memora](https://github.com/zaberhossen/Memora), an
offline-first flashcard PWA. `catalog.json` is the index the app's Explore page
reads; `lessons/*.json` are the decks themselves. There is no backend —
publishing a deck is a pull request.

Point the app at this catalog with:

```
NEXT_PUBLIC_CATALOG_URL=https://raw.githubusercontent.com/zaberhossen/memora-community-hub/main/catalog.json
```

To contribute: fork, add `lessons/<subject>-<topic>.json` (required fields
`lessonId`, `title`, `cards[].id`, `cards[].front`, `cards[].back`), add the
matching entry to `catalog.json` with an accurate `cardCount` and an absolute
raw `url`, verify the JSON parses, and open a PR. The field tables and the
pre-PR checklist above apply as written — every key is in English.

Two things that bite people: keep card `id`s stable across updates (a new `id`
is a new card to the app, and the old card's review history is dropped), and
reuse existing `tags` instead of inventing near-duplicates, since they drive the
filter chips on Explore. The decks currently in this repo are demo content.
