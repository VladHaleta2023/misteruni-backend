import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    super({
        clientID: configService.get<string>('FACEBOOK_CLIENT_ID')!,
        clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET')!,
        callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL')!,
        scope: ['email'],
        profileFields: ['id', 'emails', 'name', 'displayName'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    const email = profile.emails?.[0]?.value;

    const user = {
      provider: 'FACEBOOK',
      providerId: profile.id,
      email,
      username:
        profile.displayName ||
        `${profile.name?.givenName ?? ''} ${profile.name?.familyName ?? ''}`.trim(),
    };

    done(null, user);
  }
}