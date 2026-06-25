import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import { useTheme } from '../../context/themeContext';
import "./TableListeStyle.css";

const createEmptyRowSelection = () => ({ type: 'include', ids: new Set() });

const normalizeRowSelection = (selectionModel) => {
	if (Array.isArray(selectionModel)) {
		return { type: 'include', ids: new Set(selectionModel) };
	}

	if (selectionModel && selectionModel.ids instanceof Set) {
		return selectionModel;
	}

	return createEmptyRowSelection();
};

export default function TableListReactif_delBtn({
	TabLisHead,
	TabListBody,
	onRowClick,
	createRow,
	isLoading = false,
	actionColumn = null,
	columnFlexOverrides = {},
	columnMinWidthOverrides = {}
}) {
	const { theme } = useTheme();
	const containerRef = useRef(null);
	const [rowSelectionModel, setRowSelectionModel] = useState(createEmptyRowSelection);
	const tableBgColor = theme === "light" ? "var(--whiteBe)" : "var(--noir)";
	const isRowClickable = typeof onRowClick === "function";

	const clearRowSelection = useCallback(() => {
		setRowSelectionModel(createEmptyRowSelection());
	}, []);

	useEffect(() => {
		const handlePointerDownOutside = (event) => {
			if (containerRef.current && !containerRef.current.contains(event.target)) {
				clearRowSelection();
			}
		};

		document.addEventListener('pointerdown', handlePointerDownOutside);
		return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
	}, [clearRowSelection]);

	const handleGridSelectionChange = useCallback((selectionModel) => {
		setRowSelectionModel(normalizeRowSelection(selectionModel));
	}, []);

	const handleRowClick = useCallback((params) => {
		if (!isRowClickable) return;
		onRowClick(params.row.id);
		setRowSelectionModel({ type: 'include', ids: new Set([params.row.id]) });
	}, [isRowClickable, onRowClick]);

	const columns = TabLisHead.map((col, index) => {
		const rawCol = String(col ?? "");
		const [fieldToken, headerToken] = rawCol.includes("|")
			? rawCol.split("|")
			: [rawCol, rawCol];
		const field = String(fieldToken ?? "").trim().toLowerCase();
		const headerName = String(headerToken ?? fieldToken ?? "").trim();
		const defaultFlex = index == 0 ? 1.70 : 1;
		const resolvedFlex = Number(columnFlexOverrides[field]);
		const resolvedMinWidth = Number(columnMinWidthOverrides[field]);

		return ({
		field,
		headerName,
		flex: Number.isFinite(resolvedFlex) ? resolvedFlex : defaultFlex,
		minWidth: Number.isFinite(resolvedMinWidth) ? resolvedMinWidth : undefined,
		headerAlign: 'left',
		align: 'left',
		sortable: true,
		filterable: true,
		resizable: false,
	});
	});

	if (actionColumn && typeof actionColumn.renderCell === "function") {
		columns.push({
			field: actionColumn.field || "action",
			headerName: actionColumn.headerName || "Action",
			flex: actionColumn.flex ?? 0.95,
			minWidth: actionColumn.minWidth ?? 120,
			headerAlign: actionColumn.headerAlign || "center",
			align: actionColumn.align || "center",
			cellClassName: actionColumn.cellClassName || "table-action-cell",
			headerClassName: actionColumn.headerClassName || "table-action-header",
			sortable: false,
			filterable: false,
			resizable: false,
			renderCell: (params) => actionColumn.renderCell(params)
		});
	}
	const rows = TabListBody.map((row, index) => (createRow(row, index)))
	const isTableEmpty = !isLoading && rows.length === 0;

	return (
		<Paper
			ref={containerRef}
			className={theme === "light" ? 'TableListContainer' : 'TableListContainerDark'}
			sx={{
				height: "100%",
				width: "100%",
				backgroundColor: theme === "light" ? "var(--whiteBe)" : "var(--darkBodyColor)",
			}}
		>
			<DataGrid
				rows={rows}
				columns={columns}
				loading={isLoading}
				hideFooter={isTableEmpty}
				localeText={{
					noRowsLabel: "",
					noResultsOverlayLabel: ""
				}}
				pagination
				autoPageSize
				initialState={{
					pagination: { paginationModel: { page: 0 } },
				}}
				disableColumnMenu
				disableColumnFilter
				disableColumnSelector
				checkboxSelection={false}
				disableMultipleRowSelection
				disableRowSelectionOnClick={!isRowClickable}
				rowSelectionModel={rowSelectionModel}
				onRowSelectionModelChange={handleGridSelectionChange}
				onRowClick={isRowClickable ? handleRowClick : undefined}

				sx={{
					"--DataGrid-rowBorderColor": isTableEmpty ? "transparent" : undefined,
					width: "100%",
					height: "100%",
					border: 0,
					color: theme === "light" ? "var(--noir)" : "var(--whiteBe)",
					backgroundColor: tableBgColor,
					"& .MuiDataGrid-overlayWrapper": {
						backgroundColor: tableBgColor,
						borderTop: isTableEmpty ? "none" : undefined,
						borderBottom: isTableEmpty ? "none" : undefined
					},
					"& .MuiDataGrid-overlayWrapperInner": {
						backgroundColor: tableBgColor,
						borderTop: isTableEmpty ? "none" : undefined,
						borderBottom: isTableEmpty ? "none" : undefined
					},
					"& .MuiDataGrid-overlay": {
						backgroundColor: "transparent",
					},
					"& .MuiDataGrid-noRowsOverlay, & .MuiDataGrid-noResultsOverlay": {
						backgroundColor: "transparent",
					},
					"& .MuiDataGrid-cell": {
						opacity: 0.85,
						cursor: isRowClickable ? "pointer" : "default",
						borderColor: theme === "dark" ? "var(--whiteTransp)" : ""
					},
					"& .table-action-cell": {
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						paddingLeft: "6px !important",
						paddingRight: "6px !important",
					},
					"& .table-action-header .MuiDataGrid-columnHeaderTitleContainer": {
						width: "100%",
						justifyContent: "center",
					},
					"& .table-action-header .MuiDataGrid-columnHeaderTitleContainerContent": {
						display: "flex",
						justifyContent: "center",
						width: "100%",
					},
					"& .MuiDataGrid-columnHeaders": {
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
						color: theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
						position: "sticky",
						top: 0,
						zIndex: 1,
						borderBottom: isTableEmpty ? "none" : undefined,
					},
					"& .MuiDataGrid-footerContainer": {
						backgroundColor: theme === "light" ? "var(--whiteBe)" : "var(--darkBodyColor)",
						borderColor: theme === "dark" ? "var(--whiteTransp)" : "",
						borderTop: isTableEmpty ? "none" : undefined
					},
					"& .MuiDataGrid-virtualScrollerContent": {
						borderTop: isTableEmpty ? "none" : undefined,
						borderBottom: isTableEmpty ? "none" : undefined
					},
					"& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
						outline: "none !important",
						
					},
					"& .MuiDataGrid-row--borderBottom .MuiDataGrid-columnHeader ": {
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
						borderColor: theme === "dark" ? "var(--whiteTransp)" : ""
					},
					"& .MuiDataGrid-columnHeaders .MuiDataGrid-filler" : {
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
					},
					"& .css-1gak8h1-MuiToolbar-root-MuiTablePagination-toolbar" : {
						color: theme === "light" ? "var(--noir)" : "var(--whiteBe)",
						
					},
					" & .MuiDataGrid-row.Mui-selected" : {
						backgroundColor : "inherit",
						color: "inherit",
					},
					" & .MuiDataGrid-row.Mui-selected:hover" : {
						backgroundColor : "inherit",
						color: "inherit",
					},
					"& .MuiDataGrid-row:hover" : {
						backgroundColor: theme === "light" ? "#e7e7e7ff" : "#3f3f3fff",
					},
					"& .css-1x1tddn-MuiButtonBase-root-MuiIconButton-root-MuiDataGrid-sortButton" : {
						color: theme === "light" ? "rgba(0, 0, 0, 0.54)" : "var(--whiteTransp)",
					},
					"& .css-1tdeh38" : {
						borderColor: theme === "dark" ? "var(--whiteTransp)" : ""
					},
					"& .css-1j20uzp" : {
						width: "0",
					},
					"& .css-cdtzx3-MuiButtonBase-root-MuiIconButton-root.Mui-disabled": {
						color: theme === "dark" ? "var(--whiteTransp)" : ""
					}
				}}
			/>
		</Paper>
	);
}
