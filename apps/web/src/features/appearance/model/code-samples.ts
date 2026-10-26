export type CodeSample = {
  id: string;
  label: string;
  sample: string;
};

const TYPESCRIPT_SAMPLE: CodeSample = {
  id: "typescript",
  label: "TypeScript",
  sample: `type Repo = { name: string; stars: number };

const repos: Repo[] = [
  { name: "doxynix", stars: 1024 },
  { name: "cli", stars: 258 },
];

const featured = repos.reduce((best, repo) =>
  repo.stars > best.stars ? repo : best,
);

console.log(featured.name, "—", featured.stars, "stars");`,
};

export const CODE_SAMPLES: readonly CodeSample[] = [
  TYPESCRIPT_SAMPLE,
  {
    id: "javascript",
    label: "JavaScript",
    sample: `const repos = [
  { name: "doxynix", stars: 1024 },
  { name: "cli", stars: 258 },
];

const featured = repos.reduce((best, repo) =>
  repo.stars > best.stars ? repo : best,
);

console.log(featured.name, "—", featured.stars, "stars");`,
  },
  {
    id: "python",
    label: "Python",
    sample: `from dataclasses import dataclass


@dataclass
class Repo:
    name: str
    stars: int


repos = [Repo("doxynix", 1024), Repo("cli", 258)]
featured = max(repos, key=lambda repo: repo.stars)

print(f"{featured.name} — {featured.stars} stars")`,
  },
  {
    id: "go",
    label: "Go",
    sample: `package main

import "fmt"

type Repo struct {
	Name  string
	Stars int
}

func main() {
	repos := []Repo{{"doxynix", 1024}, {"cli", 258}}
	featured := repos[0]

	for _, repo := range repos[1:] {
		if repo.Stars > featured.Stars {
			featured = repo
		}
	}

	fmt.Printf("%s — %d stars\\n", featured.Name, featured.Stars)
}`,
  },
  {
    id: "rust",
    label: "Rust",
    sample: `struct Repo {
    name: String,
    stars: u32,
}

impl Repo {
    fn new(name: &str, stars: u32) -> Self {
        Self { name: name.into(), stars }
    }
}

fn main() {
    let repos = [Repo::new("doxynix", 1024), Repo::new("cli", 258)];
    let featured = repos.iter().max_by_key(|repo| repo.stars).unwrap();

    println!("{} — {} stars", featured.name, featured.stars);
}`,
  },
  {
    id: "java",
    label: "Java",
    sample: `import java.util.Comparator;
import java.util.List;

record Repo(String name, int stars) {}

public class Main {
    public static void main(String[] args) {
        var repos = List.of(new Repo("doxynix", 1024), new Repo("cli", 258));
        var featured = repos.stream()
            .max(Comparator.comparingInt(Repo::stars))
            .orElseThrow();

        System.out.printf("%s — %d stars%n", featured.name(), featured.stars());
    }
}`,
  },
  {
    id: "kotlin",
    label: "Kotlin",
    sample: `data class Repo(val name: String, val stars: Int)

fun main() {
    val repos = listOf(Repo("doxynix", 1024), Repo("cli", 258))
    val featured = repos.maxBy { it.stars }

    println("\${featured.name} — \${featured.stars} stars")
}`,
  },
  {
    id: "swift",
    label: "Swift",
    sample: `struct Repo {
    let name: String
    let stars: Int
}

let repos = [
    Repo(name: "doxynix", stars: 1024),
    Repo(name: "cli", stars: 258),
]

let featured = repos.max { $0.stars < $1.stars }!

print("\\(featured.name) — \\(featured.stars) stars")`,
  },
  {
    id: "csharp",
    label: "C#",
    sample: `using System;
using System.Linq;

public record Repo(string Name, int Stars);

public static class Program
{
    public static void Main()
    {
        var repos = new[] { new Repo("doxynix", 1024), new Repo("cli", 258) };
        var featured = repos.MaxBy(repo => repo.Stars)!;

        Console.WriteLine($"{featured.Name} — {featured.Stars} stars");
    }
}`,
  },
  {
    id: "c",
    label: "C",
    sample: `#include <stdio.h>

typedef struct {
    const char *name;
    int stars;
} Repo;

int main(void) {
    Repo repos[] = {{"doxynix", 1024}, {"cli", 258}};
    Repo featured = repos[0];

    for (int i = 1; i < 2; i++) {
        if (repos[i].stars > featured.stars) {
            featured = repos[i];
        }
    }

    printf("%s — %d stars\\n", featured.name, featured.stars);
}`,
  },
  {
    id: "cpp",
    label: "C++",
    sample: `#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Repo {
    std::string name;
    int stars;
};

int main() {
    std::vector<Repo> repos = {{"doxynix", 1024}, {"cli", 258}};

    auto featured = std::max_element(
        repos.begin(), repos.end(),
        [](const Repo &a, const Repo &b) { return a.stars < b.stars; });

    std::cout << featured->name << " — " << featured->stars << " stars\\n";
}`,
  },
  {
    id: "php",
    label: "PHP",
    sample: `<?php

final class Repo
{
    public function __construct(
        public readonly string $name,
        public readonly int $stars,
    ) {}
}

$repos = [new Repo('doxynix', 1024), new Repo('cli', 258)];
$featured = $repos[0];

foreach ($repos as $repo) {
    if ($repo->stars > $featured->stars) {
        $featured = $repo;
    }
}

echo "{$featured->name} — {$featured->stars} stars\\n";`,
  },
  {
    id: "ruby",
    label: "Ruby",
    sample: `Repo = Struct.new(:name, :stars)

repos = [Repo.new("doxynix", 1024), Repo.new("cli", 258)]
featured = repos.max_by(&:stars)

puts "#{featured.name} — #{featured.stars} stars"`,
  },
  {
    id: "dart",
    label: "Dart",
    sample: `class Repo {
  const Repo(this.name, this.stars);

  final String name;
  final int stars;
}

void main() {
  const repos = [Repo('doxynix', 1024), Repo('cli', 258)];
  final featured = repos.reduce((a, b) => a.stars >= b.stars ? a : b);

  print('\${featured.name} — \${featured.stars} stars');
}`,
  },
  {
    id: "scala",
    label: "Scala",
    sample: `case class Repo(name: String, stars: Int)

@main def run(): Unit =
  val repos = List(Repo("doxynix", 1024), Repo("cli", 258))
  val featured = repos.maxBy(_.stars)

  println(s"\${featured.name} — \${featured.stars} stars")`,
  },
  {
    id: "elixir",
    label: "Elixir",
    sample: `defmodule Repo do
  defstruct [:name, :stars]
end

repos = [
  %Repo{name: "doxynix", stars: 1024},
  %Repo{name: "cli", stars: 258}
]

featured = Enum.max_by(repos, & &1.stars)

IO.puts("#{featured.name} — #{featured.stars} stars")`,
  },
  {
    id: "haskell",
    label: "Haskell",
    sample: `import Data.List (maximumBy)
import Data.Ord (comparing)

data Repo = Repo { name :: String, stars :: Int }

repos :: [Repo]
repos = [Repo "doxynix" 1024, Repo "cli" 258]

main :: IO ()
main = do
    let featured = maximumBy (comparing stars) repos
    putStrLn (name featured ++ " — " ++ show (stars featured) ++ " stars")`,
  },
  {
    id: "lua",
    label: "Lua",
    sample: `local repos = {
  { name = "doxynix", stars = 1024 },
  { name = "cli", stars = 258 },
}

local featured = repos[1]
for _, repo in ipairs(repos) do
  if repo.stars > featured.stars then
    featured = repo
  end
end

print(featured.name .. " — " .. featured.stars .. " stars")`,
  },
  {
    id: "zig",
    label: "Zig",
    sample: `const std = @import("std");

const Repo = struct {
    name: []const u8,
    stars: u32,
};

pub fn main() void {
    const repos = [_]Repo{
        .{ .name = "doxynix", .stars = 1024 },
        .{ .name = "cli", .stars = 258 },
    };

    var featured = repos[0];
    for (repos) |repo| {
        if (repo.stars > featured.stars) featured = repo;
    }

    std.debug.print("{s} — {d} stars\\n", .{ featured.name, featured.stars });
}`,
  },
  {
    id: "perl",
    label: "Perl",
    sample: `use strict;
use warnings;

my @repos = (
    { name => "doxynix", stars => 1024 },
    { name => "cli", stars => 258 },
);

my ($featured) = sort { $b->{stars} <=> $a->{stars} } @repos;

printf "%s — %d stars\\n", $featured->{name}, $featured->{stars};`,
  },
  {
    id: "r",
    label: "R",
    sample: `repos <- data.frame(
  name = c("doxynix", "cli"),
  stars = c(1024L, 258L)
)

featured <- repos[which.max(repos$stars), ]

cat(featured$name, "—", featured$stars, "stars\\n")`,
  },
  {
    id: "sql",
    label: "SQL",
    sample: `select name, stars
from repos
order by stars desc
limit 1;`,
  },
  {
    id: "bash",
    label: "Bash",
    sample: `#!/usr/bin/env bash
set -euo pipefail

repos='[{"name":"doxynix","stars":1024},{"name":"cli","stars":258}]'

echo "$repos" | jq -r 'max_by(.stars) | "\\(.name) — \\(.stars) stars"'`,
  },
  {
    id: "json",
    label: "JSON",
    sample: `{
  "repos": [
    { "name": "doxynix", "stars": 1024 },
    { "name": "cli", "stars": 258 }
  ],
  "featured": "doxynix"
}`,
  },
  {
    id: "yaml",
    label: "YAML",
    sample: `repos:
  - name: doxynix
    stars: 1024
  - name: cli
    stars: 258

featured: doxynix`,
  },
  {
    id: "toml",
    label: "TOML",
    sample: `[[repos]]
name = "doxynix"
stars = 1024

[[repos]]
name = "cli"
stars = 258

featured = "doxynix"`,
  },
  {
    id: "html",
    label: "HTML",
    sample: `<article class="repo" data-featured="true">
  <h2>doxynix</h2>
  <span>1024 stars</span>
</article>

<article class="repo">
  <h2>cli</h2>
  <span>258 stars</span>
</article>`,
  },
  {
    id: "css",
    label: "CSS",
    sample: `.repo {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.repo[data-featured="true"] {
  border-color: var(--primary);
}`,
  },
  {
    id: "markdown",
    label: "Markdown",
    sample: `# Repositories

| Name    | Stars |
| ------- | ----- |
| doxynix | 1024  |
| cli     | 258   |

The featured repository is **doxynix**.`,
  },
  {
    id: "graphql",
    label: "GraphQL",
    sample: `query FeaturedRepo {
  repos(first: 2, orderBy: STARS) {
    nodes {
      name
      stars
    }
  }
}`,
  },
  {
    id: "dockerfile",
    label: "Dockerfile",
    sample: `FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "start"]`,
  },
];

export const DEFAULT_CODE_SAMPLE_ID = TYPESCRIPT_SAMPLE.id;

export function findCodeSample(id: string): CodeSample {
  return CODE_SAMPLES.find((entry) => entry.id === id) ?? TYPESCRIPT_SAMPLE;
}
