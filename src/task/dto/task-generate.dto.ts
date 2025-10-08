import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class TaskAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsString()
  note: string;

  @IsInt()
  @IsOptional()
  difficulty?: number;

  @IsInt()
  @IsOptional()
  threshold?: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsOptional()
  subtopics?: [string, number][];

  @IsArray()
  @IsString({ each: true })
  outputSubtopics: string[];
}

export class InteractiveTaskAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsInt()
  @IsOptional()
  difficulty?: number;

  @IsString()
  translate: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsOptional()
  subtopics?: [string, number][];
}

export class QuestionsTaskAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsInt()
  @IsOptional()
  difficulty?: number;

  @IsArray()
  @IsString({ each: true })
  questions: string[];

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class SolutionAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsString()
  solution: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class OptionsAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsString()
  solution: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsArray()
  @IsString({ each: true })
  explanations: string[];

  @IsInt()
  correctOptionIndex: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class ProblemsAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsString()
  solution: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsInt()
  correctOptionIndex: number;

  @IsInt()
  userOptionIndex: number;

  @IsString()
  userSolution: string;

  @IsInt()
  @IsOptional()
  difficulty?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subtopics: string[];

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  outputSubtopics: [string, number][]

  @IsString()
  explanation: string
}

export class WordAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  changed: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsInt()
  attempt: number;

  @IsArray()
  @IsOptional()
  words?: [string, string][];

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsString({ each: true })
  outputWords: string[];

  @IsString()
  outputText: string;
}