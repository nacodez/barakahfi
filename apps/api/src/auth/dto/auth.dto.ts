import { LIMITS, PASSWORD_REGEX } from '@barakahfi/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITS.NAME_MAX)
  name!: string;

  @Transform(lower)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(LIMITS.PASSWORD_MIN)
  @MaxLength(LIMITS.PASSWORD_MAX)
  @Matches(PASSWORD_REGEX, { message: 'password must include an uppercase letter and a number' })
  password!: string;
}

export class LoginDto {
  @Transform(lower)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LIMITS.PASSWORD_MAX)
  password!: string;
}
