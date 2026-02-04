import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

/**
 * Guardrail: AppModule must compile without circular dependency errors.
 * DemoModule refactor (DemoInfraModule) ensures no cycle between Demo, Auth, and Tenant.
 */
describe('AppModule', () => {
  it('compiles without circular dependency', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleFixture).toBeDefined();
  });
});
