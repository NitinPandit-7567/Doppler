'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SteamInventoryItem } from '@doppler/types';

function getWearCondition(name: string): string | null {
  const match = /\(([\w-]+)\)$/.exec(name);
  return match?.[1] ?? null;
}

const columns: ColumnDef<SteamInventoryItem>[] = [
  {
    id: 'icon',
    header: '',
    cell: ({ row }) => (
      <Image
        src={row.original.iconUrl}
        alt={row.original.marketHashName}
        width={48}
        height={36}
        className="rounded"
      />
    ),
    size: 60,
    enableSorting: false,
  },
  {
    accessorKey: 'marketHashName',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Item
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.original.marketHashName;
      const wear = getWearCondition(name);
      return (
        <div>
          <div className="font-medium">{name.replace(/\s*\([\w-]+\)$/, '')}</div>
          {wear && (
            <Badge variant="secondary" className="mt-1 text-xs">
              {wear}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: 'tradable',
    header: 'Status',
    cell: ({ row }) =>
      row.original.tradable ? (
        <Badge variant="default">Tradable</Badge>
      ) : (
        <Badge variant="secondary">Locked</Badge>
      ),
    enableSorting: false,
  },
];

interface InventoryTableProps {
  readonly items: readonly SteamInventoryItem[];
  readonly isLoading: boolean;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-12 rounded" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function InventoryTable({ items, isLoading }: InventoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: items as SteamInventoryItem[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        No items found in inventory.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
