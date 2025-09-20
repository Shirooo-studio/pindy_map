class PostsController < ApplicationController
  before_action :authenticate_user!, only: [ :create ]
  before_action :set_post, only: [ :show, :edit, :update, :destroy ]

  # GET /posts/by_place?place_id=ChIJ...
  def by_place
    pid = params[:place_id].to_s
    return render json: [] if pid.blank?

    posts =
      if Post.column_names.include?("pin_id")
        # 新スキーマ: pin 経由
        pins = Pin.where(google_place_id: pid)
        Post.includes(:user, media_attachments: :blob)
            .where(pin_id: pins.select(:id))
            .order(created_at: :desc)
            .limit(50)
      else
        # 旧スキーマ: place_id 直接
        Post.includes(:user, media_attachments: :blob)
            .where(place_id: pid)
            .order(created_at: :desc)
            .limit(50)
      end

    render json: posts.map { |p|
      {
        id: p.id,
        title: p.try(:title).to_s,
        body: p.try(:body).to_s,
        user_name: p.user&.username.presence || p.user&.full_name.presence || p.user&.email || "アカウント名",
        user_avatar_url: nil,
        media: p.media.map do |att|
          ct = att.content_type.to_s
          if ct.start_with?("video/")
            {
              type: "video",
              url: url_for(att),
              poster: (att.previewable? ? url_for(att.preview(resize_to_limit: [ 640, 360 ]).processed) : nil)
            }
          else
            {
              type: "image",
              url: url_for(att)
            }
          end
        end,
        tags: []
      }
    }
  end

  # GET /posts/count_by_place?place_ids=aaa,bbb
  def count_by_place
    ids = params[:place_ids].to_s.split(",").map(&:strip).reject(&:blank?).uniq.first(100)
    return render json: {} if ids.empty?

    if Post.column_names.include?("pin_id")
      # 新スキーマ: pins 経由で google_place_id ごとに集計
      counts = Pin.where(google_place_id: ids)
                  .joins(:posts)
                  .group("pins.google_place_id")
                  .count
      render json: counts
    else
      # 旧スキーマ: place_id に直接カウント
      render json: Post.where(place_id: ids).group(:place_id).count
    end
  end

  # GET /posts or /posts.json
  def index
    @posts = Post.all
  end

  # GET /posts/1 or /posts/1.json
  def show
  end

  # GET /posts/new
  def new
    @post = Post.new
  end

  # GET /posts/1/edit
  def edit
  end

  # POST /posts or /posts.json
  def create
    place_id = post_params[:google_place_id].presence
    return render json: { errors: [ "google_place_id が指定されていません" ] }, status: :unprocessable_entity if place_id.blank?

    if Post.column_names.include?("pin_id")
      pin = Pin.find_by(google_place_id: place_id)
      return render(json: { errors: [ "この場所のピンが見つかりません。先に📍で保存してください" ] }, status: :unprocessable_entity) unless pin

      post = current_user.posts.new(
        pin: pin,
        title: post_params[:title],
        body: post_params[:body],
        visibility: (post_params[:visibility].presence || :company_only)
      )
    else
      post = current_user.posts.new(
        title: post_params[:title],
        body: post_params[:body],
        place_id: place_id
      )
    end

    if params[:post][:media].present?
      Array(params[:post][:media]).first(10).each { |io| post.media.attach(io) }
    end

    if post.save
      render json: { post_id: post.id }, status: :created
    else
      render json: { errors: post.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /posts/1 or /posts/1.json
  def update
    if @post.update(post_params)
      redirect_to @post, notice: "Post was successfully updated.", status: :see_other
    else
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /posts/1 or /posts/1.json
  def destroy
    @post.destroy!
    redirect_to posts_path, notice: "Post was successfully destroyed.", status: :see_other
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_post
      @post = Post.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def post_params
      params.require(:post).permit(:title, :body, :visibility, :google_place_id, media: [])
    end
end
