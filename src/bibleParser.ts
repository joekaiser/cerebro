import log from "@/log.ts";

const bibleBooks = [
  "GENESIS",
  "EXODUS",
  "LEVITICUS",
  "NUMBERS",
  "DEUTERONOMY",
  "JOSHUA",
  "JUDGES",
  "RUTH",
  "1 SAMUEL",
  "2 SAMUEL",
  "1 KINGS",
  "2 KINGS",
  "1 CHRONICLES",
  "2 CHRONICLES",
  "EZRA",
  "NEHEMIAH",
  "ESTHER",
  "JOB",
  "PSALM",
  "PROVERBS",
  "ECCLESIASTES",
  "SONG OF SOLOMON",
  "ISAIAH",
  "JEREMIAH",
  "LAMENTATIONS",
  "EZEKIEL",
  "DANIEL",
  "HOSEA",
  "JOEL",
  "AMOS",
  "OBADIAH",
  "JONAH",
  "MICAH",
  "NAHUM",
  "HABAKKUK",
  "ZEPHANIAH",
  "HAGGAI",
  "ZECHARIAH",
  "MALACHI",
  "MATTHEW",
  "MARK",
  "LUKE",
  "JOHN",
  "ACTS",
  "ROMANS",
  "1 CORINTHIANS",
  "2 CORINTHIANS",
  "GALATIANS",
  "EPHESIANS",
  "PHILIPPIANS",
  "COLOSSIANS",
  "1 THESSALONIANS",
  "2 THESSALONIANS",
  "1 TIMOTHY",
  "2 TIMOTHY",
  "TITUS",
  "PHILEMON",
  "HEBREWS",
  "JAMES",
  "1 PETER",
  "2 PETER",
  "1 JOHN",
  "2 JOHN",
  "3 JOHN",
  "JUDE",
  "REVELATION",
];

export function getBookOfTheBible(text: string) {
  log.debug("Getting book of bible from", text);
  for (const book of bibleBooks) {
    //this repalce hack makes it so we can easily match things like Psalms to Psalm
    if (
      text.toUpperCase().replaceAll("S", "").includes(book.replaceAll("S", ""))
    ) {
      log.debug("Found book of bible:", book);
      return book;
    }
  }
}
