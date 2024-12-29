'use client'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SBT_ROLE_ADDRESS, SBT_ROLE_ABI } from '@/config/contracts';
import { RocketIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';


const RoleSelection = () => {
  const { toast } = useToast();
  const { address } = useAccount();
  const [transactionHash, setTransactionHash] = useState(null);
  const [hasToken, setHasToken] = useState(false);

  const roles = [
    { id: 0, name: "Task Provider", description: "Create and manage tasks", icon: "🏢" },
    { id: 1, name: "Developer", description: "Complete tasks and earn rewards", icon: "👨‍💻" },
    { id: 2, name: "Auditor", description: "Review and validate work", icon: "🔍" }
  ];

  const { isLoading: isRequestingSBT, isSuccess: isSBTMinted } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useWatchContractEvent({
    address: SBT_ROLE_ADDRESS,
    abi: SBT_ROLE_ABI,
    eventName: 'SBTMinted',
    onLogs: (logs) => {
      const event = logs[0];
      if (event.args.to === address && event.transactionHash === transactionHash) {
        toast({
          title: "SBT Minted!",
          description: `Role successfully assigned to ${event.args.to}`,
          duration: 5000,
        });
        setHasToken(true);
        setTimeout(() => window.location.reload(), 2000);
      }
    },
  });

  const { error, isPending, writeContract } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setTransactionHash(hash);
        toast({
          title: "Transaction Sent",
          description: "Your role request is being processed...",
          duration: 5000,
        });
      },
      onError: (error) => {
        console.error("Contract Error:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.shortMessage || "Failed to request SBT",
          duration: 5000,
        });
      },
    }
  });

  const { data: hasExistingToken } = useReadContract({
    address: SBT_ROLE_ADDRESS,
    abi: SBT_ROLE_ABI,
    functionName: 'hasToken',
    args: [address],
    watch: true,
    pollingInterval: 3000,
  });

  useEffect(() => {
    if (hasExistingToken) {
      setHasToken(true);
    }
  }, [hasExistingToken]);

  const handleRoleSelection = async (roleId) => {
    writeContract({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        functionName: 'requestSBT',
        args: [roleId],
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Select Your Role</h2>
      {transactionHash && !isSBTMinted && (
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-600">Transaction Hash:</p>
          <a 
            href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 break-all font-mono text-sm"
          >
            {transactionHash}
          </a>
        </div>
      )}
      <div className="mt-4">
        {isRequestingSBT && (
          <Alert>
            <RocketIcon className="h-4 w-4" />
            <AlertTitle>Requesting SBT...</AlertTitle>
            <AlertDescription>
              Please wait for the transaction to complete.
            </AlertDescription>
          </Alert>
        )}
        
        {isSBTMinted && (
          <Alert className="bg-green-50">
            <AlertTitle>Role Assigned!</AlertTitle>
            <AlertDescription>
              Your role has been successfully assigned. The page will refresh shortly...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error.shortMessage || "Failed to request SBT"}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {hasToken ? (
        <Alert className="mb-6">
          <AlertTitle>You already have a role</AlertTitle>
          <AlertDescription>
            You cannot select another role while you have an active SBT.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 mt-5">
          {roles.map((role) => (
            <div key={role.id} className="p-6 border rounded-lg text-center">
              <div className="text-4xl mb-4">{role.icon}</div>
              <h3 className="text-xl font-bold mb-2">{role.name}</h3>
              <p className="text-gray-600 mb-4">{role.description}</p>
              <Button 
                disabled={isPending || hasToken} 
                onClick={() => handleRoleSelection(role.id)}
              >
                {isPending ? 'Requesting...' : 'Select Role'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleSelection; 