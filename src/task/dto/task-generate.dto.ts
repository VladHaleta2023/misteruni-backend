import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
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
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  literature?: string;

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
  threshold?: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subtopics?: [string][];

  @IsArray()
  @IsString({ each: true })
  outputSubtopics: string[];
}

export class WritingAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  literature?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  text: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
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

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsString()
  translate: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsOptional()
  subtopics?: [string, number][];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  words?: string[]

  @IsArray()
  @IsString({ each: true })
  outputWords: string[];
}

export class SolutionGuideAIGenerate {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

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

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

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

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsString({ each: true })
  subtopics: string[];

  @IsInt()
  randomOption: number;
}

export class ProblemsAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

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

  @IsString()
  correctOption: string;

  @IsString()
  userSolution: string;

  @IsString()
  userOption: string;

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
  explanation: string;

  @IsString()
  chat: string;
}

export class ChatAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

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

  @IsString()
  userSolution: string;

  @IsString()
  userOption: string;

  @IsString()
  correctOption: string;

  @IsArray()
  @IsString({ each: true })
  subtopics: string[];

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsString()
  chat: string;

  @IsBoolean()
  chatFinished: boolean;
}

export class VocabluaryAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  changed: string;

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

export class VocabluaryGuideAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsArray()
  text: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsString()
  translate: string;
}