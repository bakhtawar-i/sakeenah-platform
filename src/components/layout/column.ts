/**
 * The app column: centred, max 430px, full width on phones. On screens wider
 * than the column it becomes a card (24px radius, hairline border, soft shadow)
 * on a blush page, so artwork cropped at the column edge reads as intentional.
 * overflow-clip crops the art to the column (and its rounded corners) without
 * creating a scroll container.
 */
export const COLUMN_CLASS =
  "relative mx-auto w-full max-w-[430px] overflow-clip bg-cream " +
  "min-[431px]:my-6 min-[431px]:rounded-[24px] min-[431px]:border min-[431px]:border-hairline " +
  "min-[431px]:shadow-[0_12px_40px_-12px_rgba(58,28,30,0.14)]";
