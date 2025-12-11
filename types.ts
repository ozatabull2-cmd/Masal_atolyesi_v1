
export enum AgeGroup {
  Toddler = "3-5",
  Child = "6-8",
  PreTeen = "9+"
}

export enum Gender {
  Girl = "Kız",
  Boy = "Erkek",
  Neutral = "Belirtmek İstemiyorum"
}

export interface UserInput {
  childName: string;
  age: AgeGroup;
  gender: Gender;
  hairColor?: string; // Optional hair color
  eyeColor?: string;  // Optional eye color
  category: string;
  moral: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string; // Generated later
  audioBase64?: string; // Generated later
}

export interface StoryData {
  title: string;
  summary: string;
  coverImagePrompt: string; // New field
  coverImageUrl?: string;   // New field
  pages: StoryPage[];
}

export enum AppState {
  Input,
  GeneratingStory,
  GeneratingImages,
  Reading,
  Error,
  Cooldown
}
