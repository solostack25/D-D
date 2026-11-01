import type { Metadata } from "next";
import CharacterCreator from "./CharacterCreator";

export const metadata: Metadata = { title: "Create a character — Tavernlight" };

export default function CreatePage() {
  return <CharacterCreator />;
}
