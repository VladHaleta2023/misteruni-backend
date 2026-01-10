import {
  IsArray,
  IsInt,
  IsNumber,
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

  @IsString()
  note: string;

  @IsString()
  mode: string;

  @IsOptional()
  @IsNumber()
  taskId?: number | null;

  @IsInt()
  @IsOptional()
  threshold?: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsOptional()
  subtopics?: [string, number, number][];

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

  @IsArray()
  @IsString({ each: true })
  subtopics: string[];
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

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @IsArray()
  @IsString({ each: true })
  subtopics: string[];

  @IsInt()
  random1: number;

  @IsInt()
  random2: number;
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

  @IsString()
  correctOption: string;

  @IsString()
  userSolution: string;

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