import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { useTheme } from '../../context/themeContext';
import { formatNumberWithSpace } from '../../services/formatNumber';

import "./TableListeStyle.css"

export default function BasicTable({ rowsData = [] }) {
  const {theme} = useTheme();
  return (
    <TableContainer className={theme === "light" ? 'TableListContainer' : 'TableListContainerDark'} component={Paper} sx={{ maxHeight: "100%", maxWidth: "100%" }}>
      <Table sx={{minWidth: 65, backgroundColor: theme === "light" ? "var(--whiteBe)" : "var(--darkBodyColor)"}} stickyHeader aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
                position: 'sticky',
                top: 0,
                backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
                zIndex: 1,
              }}
            >
              Article
            </TableCell>
            <TableCell
              align="center"
              sx={{
                color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
                position: 'sticky',
                top: 0,
                backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
                zIndex: 1,
              }}
            >
              En Stock
            </TableCell>
            <TableCell
              align="center"
              sx={{
                color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
                position: 'sticky',
                top: 0,
                backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
                zIndex: 1,
              }}
            >
              Qt Vendu
            </TableCell>
            <TableCell
              align="center"
              sx={{
                color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
                position: 'sticky',
                top: 0,
                backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
                zIndex: 1,
              }}
            >
              Prix U
            </TableCell>
            <TableCell
              align="center"
              sx={{
                color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)",
                position: 'sticky',
                top: 0,
                backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
                zIndex: 1,
              }}
            >
              Prix
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody sx={{opacity: .80}}>
          {rowsData.map((row, index) => (
            <TableRow
              key={row.id || index}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell style={{color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)"}} component="th" scope="row">
                {row.designation}
              </TableCell>
              <TableCell style={{color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)"}} align="center">{row.qt_stock}</TableCell>
              <TableCell style={{color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)"}} align="center">{row.qt_vendu}</TableCell>
              <TableCell style={{color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)"}} align="center">{formatNumberWithSpace(row.prix_u)}</TableCell>
              <TableCell style={{color : theme === "light" ? "var(--noirbe)" : "var(--whiteBeMax)"}} align="center">{formatNumberWithSpace(row.prix_total_reste)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
