# Index インデックス 1

## Source code

```python
def sample(arg):
    return arg + arg
```

Call `sample` with `arg`.

    quoted text2
    quoted text2
    quoted text2
    quoted text2

# Index インデックス 1

## List and Image

* アイテム1
* Item2 ![Screenshot](images/screenshot.png)
  * Sub-item 2-1 ![External Icon](https://raw.githubusercontent.com/masamitsu-murase/publish_markdown_reports/develop/images/default_icon.png)
* Item3 ![Screenshot 2](/images/screenshot2.png)
* Item3 ![Screenshot 3](../images/screenshot3.png)

1. **Item1**
1. アイテム2
   1. Sub-item 2-1
1. *Item 3*

## Table

|Category |ID|Name  |
|:--------|-:|:----:|
|Animal   |1 |Dog   |
|Animal   |2 |Cat   |
|Insect   |3 |Beetle|

## Quote

> quoted text
> quoted text
>> quoted text
> quoted text

## link

*  [*Link* to external site](https://github.com/masamitsu-murase/publish_markdown_reports)
* pythonmarkdown style
  *  [Internal link 1](#index-1)
  *  [Internal link 2](#index-1_1)
* doxybook2 style
  *  [Internal link 1](#index-インデックス-1)
  *  [Internal link 2](#index-インデックス-1_1)
* [Link ../sample.md](../sample.md)
* [Link /dir2/sample.md](/dir2/sample.md)
