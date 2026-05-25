const ENIU_MENTION_PATTERN = /(^|[^\p{L}\p{N}_-])@eniu(?=$|[^\p{L}\p{N}_-])/iu;

export function mentionsEniu(content: string) {
  return ENIU_MENTION_PATTERN.test(content);
}
