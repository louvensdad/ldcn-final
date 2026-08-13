import { Module } from '@nestjs/common';
import { GeneratorModule } from '../generator/generator.module';
import { RuntimeController } from './runtime.controller';

@Module({
  imports: [GeneratorModule],
  controllers: [RuntimeController],
})
export class RuntimeModule {}
