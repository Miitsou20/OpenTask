'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { parseEther, formatEther } from 'viem';
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';

const CreateTaskModal = ({ open, onClose, task, isUpdateMode = false }) => {
  const { toast } = useToast();
  const [transactionHash, setTransactionHash] = useState(null);
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    reward: task?.reward ? formatEther(BigInt(task.reward)) : '',
    deadline: task?.deadline ? new Date(Number(task.deadline) * 1000).toISOString().slice(0, 16) : ''
  });

  const { isLoading: isCreatingTask, isSuccess: isTaskCreated } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useEffect(() => {
    if (isTaskCreated) {
      toast({
        title: "Success!",
        description: "Task has been created successfully.",
        duration: 5000,
      });
      
      setFormData({
        title: '',
        description: '',
        reward: '',
        deadline: ''
      });
      
      setTransactionHash(null);
      
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [isTaskCreated, onClose, toast]);

  const { writeContract } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setTransactionHash(hash);
        toast({
          title: "Transaction Sent",
          description: isUpdateMode ? "Deadline update request is being processed..." : "Task creation request is being processed...",
          duration: 5000,
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || (isUpdateMode ? "Failed to update deadline" : "Failed to create task"),
          duration: 5000,
        });
      },
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const deadline = Math.floor(new Date(formData.deadline).getTime() / 1000);
      
      if (isUpdateMode) {
        writeContract({
          address: TASK_MARKETPLACE_ADDRESS,
          abi: TASK_MARKETPLACE_ABI,
          functionName: 'updateTaskDeadline',
          args: [task.id, BigInt(deadline)]
        });
      } else {
        const reward = parseEther(formData.reward);
        writeContract({
          address: TASK_MARKETPLACE_ADDRESS,
          abi: TASK_MARKETPLACE_ABI,
          functionName: 'createTask',
          args: [formData.title, formData.description, BigInt(deadline), reward]
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to " + (isUpdateMode ? "update deadline" : "create task") + ": " + error.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? "Update Task Deadline" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isUpdateMode && (
            <>
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Task title"
                  required
                  disabled={isUpdateMode}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Task description"
                  required
                  disabled={isUpdateMode}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reward (ETH)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.reward}
                  onChange={(e) => setFormData({...formData, reward: e.target.value})}
                  placeholder="0.1"
                  required
                  disabled={isUpdateMode}
                />
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium">Deadline</label>
            <Input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({...formData, deadline: e.target.value})}
              required
            />
          </div>
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isUpdateMode ? "Update Deadline" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal; 