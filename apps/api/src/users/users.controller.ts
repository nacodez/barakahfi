import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserDto } from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<UserDto> {
    return this.users.getProfile(user.sub);
  }

  @Patch('me')
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.users.updateProfile(user.sub, dto);
  }
}
