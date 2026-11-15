export type CommentFinding = {
  file: string;
  line: number;
  suggestion: string;
  type: string;
};

type CommentLike = {
  filePath: string;
  findingType: string;
  line: number;
  suggestion: string;
};

// `findingType` is stored uppercase (`BUG`), while the fix prompt keys off the lowercase form.
export function commentToFinding(comment: CommentLike): CommentFinding {
  return {
    file: comment.filePath,
    line: comment.line,
    suggestion: comment.suggestion,
    type: comment.findingType.toLowerCase(),
  };
}

export function commentsToFindings(comments: CommentLike[]): CommentFinding[] {
  return comments.map((comment) => commentToFinding(comment));
}
