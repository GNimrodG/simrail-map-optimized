/* eslint-disable @typescript-eslint/no-explicit-any */
import { Popper } from "@mui/base/Popper";
import AutocompleteListbox from "@mui/joy/AutocompleteListbox";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import ListSubheader from "@mui/joy/ListSubheader";
import { forwardRef, HTMLAttributes, ReactElement } from "react";
import { List, RowComponentProps } from "react-window";

const LISTBOX_PADDING = 6; // px
const ITEM_SIZE = 46; // px
const VISIBLE_ITEMS = 8;

function ListboxRow({ index, style, itemData }: RowComponentProps<{ itemData: Array<any> }>) {
  const dataSet = itemData[index];

  if (Object.hasOwn(dataSet, "group")) {
    return (
      <ListSubheader key={dataSet.key} component="li" style={style}>
        {dataSet.group}
      </ListSubheader>
    );
  }

  return (
    <AutocompleteOption {...dataSet[0]} key={dataSet[0].key} style={style}>
      {dataSet[1]}
    </AutocompleteOption>
  );
}

// Adapter for react-window: the Joy listbox (with the props of the autocomplete) holds the virtualized list,
// which scrolls inside it
const ListboxComponent = forwardRef<
  HTMLDivElement,
  {
    anchorEl: any;
    open: boolean;
    modifiers: any[];
  } & HTMLAttributes<HTMLElement>
>(function ListboxComponent(props, ref) {
  const { children, anchorEl, open, modifiers, ...other } = props;
  const itemData: Array<any> = [];
  (children as [Array<{ children: Array<ReactElement> | undefined }>])[0].forEach((item) => {
    if (item) {
      itemData.push(item);
      itemData.push(...(item.children || []));
    }
  });

  return (
    <Popper ref={ref} anchorEl={anchorEl} open={open} modifiers={modifiers} style={{ zIndex: 1000 }}>
      <AutocompleteListbox
        // the autocomplete's listbox props (their HTML `color` type clashes with Joy's `color` prop)
        {...(other as any)}
        component="div"
        sx={{
          height: ITEM_SIZE * VISIBLE_ITEMS,
          // the list scrolls (with the padding), not the listbox
          overflow: "hidden",
          padding: 0,
        }}>
        <List
          tagName="ul"
          rowComponent={ListboxRow}
          rowCount={itemData.length}
          rowHeight={ITEM_SIZE}
          rowProps={{ itemData }}
          overscanCount={10}
          style={{ margin: 0, paddingInline: 0, paddingBlock: LISTBOX_PADDING }}
        />
      </AutocompleteListbox>
    </Popper>
  );
});

export default ListboxComponent;
