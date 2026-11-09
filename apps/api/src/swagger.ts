import { INestApplication } from '@nestjs/common';
import { ApiProperty, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as accounts from './accounts/dto/account.dto';
import * as auth from './auth/dto/auth.dto';
import * as budgets from './budgets/dto/budget.dto';
import * as categories from './categories/dto/category.dto';
import * as reports from './reports/dto/reports.dto';
import * as transactions from './transactions/dto/transaction.dto';
import * as users from './users/dto/update-profile.dto';

type PropertyOptions = Parameters<typeof ApiProperty>[0];
type WithFactory = { _OPENAPI_METADATA_FACTORY?: () => Record<string, PropertyOptions> };

/**
 * The Nest CLI's Swagger plugin turns our class-validator decorators into a static
 * `_OPENAPI_METADATA_FACTORY()` on each DTO. @nestjs/swagger 12 no longer reads it by itself,
 * so register it through the public `@ApiProperty()` decorator. Validation therefore stays the
 * single source of truth for the documented schemas.
 */
function registerPluginMetadata(...modules: Array<Record<string, unknown>>): void {
  for (const mod of modules) {
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const factory = (exported as WithFactory)._OPENAPI_METADATA_FACTORY;
      if (!factory) continue;
      for (const [key, options] of Object.entries(factory.call(exported))) {
        ApiProperty(options)((exported as { prototype: object }).prototype, key);
      }
    }
  }
}

/**
 * Interactive docs at /api/docs. Log in via POST /auth/login first: the browser keeps the
 * httpOnly cookie, so "Try it out" works for the protected endpoints too.
 */
export function setupSwagger(app: INestApplication): void {
  registerPluginMetadata(accounts, auth, budgets, categories, reports, transactions, users);

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('BarakahFi API')
      .setDescription(
        'Sharia-compliant personal finance: accounts, transactions, budgets and reports.',
      )
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
}
