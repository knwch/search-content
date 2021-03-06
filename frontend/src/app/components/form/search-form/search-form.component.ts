import { Component, OnInit, Input } from '@angular/core';
import {
  Validators,
  FormControl,
  FormGroup,
  FormBuilder,
} from '@angular/forms';
import { SearchState } from '../../../search/search.state';
import { EngineState } from '../../../engine/engine.state';
import {
  SearchContent,
  SetSearchParams,
  CheckHistory,
  GetContentFile,
} from '../../../search/search.action';
import { GetEngines } from '../../../engine/engine.action';
import { Select, Store } from '@ngxs/store';
import { catchError, map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-search-form',
  templateUrl: './search-form.component.html',
  styleUrls: ['./search-form.component.scss'],
  providers: [MessageService],
})
export class SearchFormComponent implements OnInit {
  @Select(EngineState.getEngineList)
  engines: any;

  @Select(SearchState.getSearchParamss)
  params: any;

  @Select(SearchState.getSelectedHistory)
  selectedHistory: any;

  searchForm!: FormGroup;

  wrapParams: any;

  wrapHistoryData: any;

  engineList: any = [];

  isManageEngineDialogOpen = false;

  isCSEDialogOpen = false;

  isContentInHistory = false;

  types = [
    { key: 'Article', value: 'article' },
    { key: 'Course', value: 'course' },
  ];

  regions = [
    { key: 'All', value: '' },
    { key: 'Thailand', value: 'countryTH' },
    { key: 'United States', value: 'countryUS' },
  ];

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private messageService: MessageService
  ) {
    this.searchForm = this.fb.group({
      contentType: new FormControl('', Validators.required),
      searchEngineId: new FormControl('', Validators.required),
      keyword: new FormControl('', Validators.required),
      page: new FormControl(''),
      region: new FormControl(''),
    });

    route.params.subscribe(() => {
      this.params.subscribe((data: any) => {
        if (data) {
          this.searchForm.patchValue(data);
        }
      });
    });
  }

  async ngOnInit(): Promise<void> {
    await this.fetchEngines();

    this.appendFakeEngineObject();
  }

  async fetchEngines(): Promise<void> {
    await this.store.dispatch(new GetEngines()).toPromise();

    await this.engines.subscribe((data: any) => {
      if (data) {
        this.engineList = data;
      }
    });
  }

  async checkHistory(params: any): Promise<void> {
    const checkSearchParams: any = {
      ...params,
      check: 'true',
    };

    await this.store
      .dispatch(new CheckHistory(checkSearchParams))
      .pipe(
        map(async (res) => {
          await this.selectedHistory.subscribe((data: any) => {
            if (data?.length > 0) {
              this.isContentInHistory = true;
            } else {
              this.isContentInHistory = false;
            }
          });
        }),
        catchError(async (error) =>
          this.messageService.add({
            severity: 'error',
            summary: `${error.error.code} - ${error.error.service}`,
            detail: `${error.error.message}`,
          })
        )
      )
      .toPromise();
  }

  async searchContent(params: any): Promise<void> {
    await this.store
      .dispatch(new SearchContent(params))
      .pipe(
        map(async (res) => {
          await this.store
            .dispatch(new SetSearchParams(this.searchForm.value))
            .toPromise();
        }),
        catchError(async (error) =>
          this.messageService.add({
            severity: 'error',
            summary: `${error.error.code} - ${error.error.service}`,
            detail: `${error.error.message}`,
          })
        )
      )
      .toPromise();
  }

  async onSubmit(value: any): Promise<void> {
    this.searchForm.controls.contentType.markAsDirty();
    this.searchForm.controls.searchEngineId.markAsDirty();
    this.searchForm.controls.keyword.markAsDirty();

    if (this.searchForm.valid) {
      const {
        contentType,
        searchEngineId,
        keyword,
        page,
        region,
      } = this.searchForm.value;

      const searchParams: any = {
        type: contentType,
        cx: searchEngineId.trim(),
        query: encodeURIComponent(keyword.trim()),
        page,
        region,
      };

      this.removeEmptyProperty(searchParams);

      await this.checkHistory(searchParams);

      if (this.isContentInHistory) {
        this.wrapParams = searchParams;
        this.displayCSEDialog();
      } else {
        await this.searchContent(searchParams);
      }
    }
  }

  async onSubmitAgain(params: any): Promise<void> {
    this.isCSEDialogOpen = false;
    this.wrapParams = null;
    await this.searchContent(params);
  }

  removeEmptyProperty(object: any): any {
    return Object.keys(object).forEach(
      (key) =>
        (object[key] === undefined || object[key] === '') && delete object[key]
    );
  }

  appendFakeEngineObject(): void {
    const creatorObject = {
      searchEngineId: 'create',
      name: 'Save Engine',
      contentType: '',
    };

    this.engineList.push(creatorObject);
  }

  displayManageEngineDialog(): void {
    this.isManageEngineDialogOpen = true;
  }

  displayCSEDialog(): void {
    this.isCSEDialogOpen = true;
  }

  onEngineChange(event: any, dropdown: any): void {
    const { originalEvent, value } = event;

    if (value === 'create') {
      dropdown.clear();
      this.handleManageEngine();
    } else {
      // mouse event
      if (originalEvent.detail === 1) {
        const selectedEngine: any = this.engineList.find(
          (engine: any) => engine.searchEngineId === value
        );

        this.searchForm.value.contentType = selectedEngine.contentType;
      }
    }
  }

  handleManageEngine(): void {
    this.searchForm.value.searchEngineId = '';
    this.searchForm.controls.searchEngineId.markAsPristine();

    this.displayManageEngineDialog();
  }

  async loadContentHistory(): Promise<void> {
    await this.selectedHistory.subscribe((data: any) => {
      if (data?.length > 0) {
        this.wrapHistoryData = data[0];
      }
    });

    if (this.wrapHistoryData) {
      const {
        keyword,
        contentType,
        page,
        region,
        searchEngineId,
        filename,
      } = this.wrapHistoryData;
      const params = {
        keyword,
        contentType,
        page,
        region,
        searchEngineId,
      };

      this.isCSEDialogOpen = false;

      const filenameEncoded = encodeURIComponent(filename);

      await this.store
        .dispatch(new GetContentFile(filenameEncoded))
        .pipe(
          map(async (res) => {
            await this.store.dispatch(new SetSearchParams(params)).toPromise();
          }),
          catchError(async (error) =>
            this.messageService.add({
              severity: 'error',
              summary: `${error.error.code} - ${error.error.service}`,
              detail: `${error.error.message}`,
            })
          )
        )
        .toPromise();
    }
  }
}
