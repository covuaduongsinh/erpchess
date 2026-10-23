import { createFileRoute } from '@tanstack/react-router';
import { EngineLab } from '../components/EngineLab';

export const Route = createFileRoute('/engine')({
  component: EngineLab,
});
