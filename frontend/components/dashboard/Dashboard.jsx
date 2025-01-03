'use client'
import { SBT_ROLE_ADDRESS, SBT_ROLE_ABI } from '@/config/contracts';
import DeveloperDashboard from '../dashboard/DeveloperDashboard';
import ProviderDashboard from '../dashboard/ProviderDashboard';
import AuditorDashboard from '../dashboard/AuditorDashboard';
import RoleSelection from '../roles/RoleSelection';
import { useAccount, useReadContract } from 'wagmi';
import React from 'react';

function Dashboard() {
    const { address } = useAccount();

    const { data: userRole } = useReadContract({
        address: SBT_ROLE_ADDRESS,
        abi: SBT_ROLE_ABI,
        functionName: 'getRole',
        args: [address],
        enabled: !!address
    });


    if (userRole === undefined) {
        return <RoleSelection />;
    }
    const DashboardComponent = {
        0: ProviderDashboard,
        1: DeveloperDashboard,
        2: AuditorDashboard,
    }[userRole] || DeveloperDashboard;
    return <DashboardComponent />;
}

export default Dashboard    