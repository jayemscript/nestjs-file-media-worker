import {
  ArrayNotEmpty,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateUploadAuthorizationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSizeBytes?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  allowedMimeTypes?: string[];
}
