import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { useReadContract, useWriteContract } from 'wagmi';

export function useTaskMarketplace() {
  const { data: tasks } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getAllTasks',
  });

  const { write: createTask } = useWriteContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'createTask',
  });

  const { write: applyForTask } = useWriteContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'applyForTaskAsDeveloper',
  });

  // Ajoutez d'autres fonctions selon vos besoins

  return {
    tasks,
    createTask,
    applyForTask,
  };
} 